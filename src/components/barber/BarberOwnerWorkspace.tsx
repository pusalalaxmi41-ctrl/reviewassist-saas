import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  LayoutDashboard,
  Scissors,
  QrCode,
  Users,
  Star,
  Plus,
  ExternalLink,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Ban,
  KeyRound,
  Trash2,
  Eye,
  EyeOff,
  Copy,
  Check,
  AlertCircle,
  Award,
  Sparkles,
  Building2,
  TrendingUp,
  MessageSquareQuote,
  BarChart3,
  IndianRupee,
  ArrowRight,
  ScanFace,
} from 'lucide-react';
import type {
  AnalyticsEvent,
  Business,
  BusinessMetrics,
  CustomerDraftRecord,
} from '../../types/business';
import type { BarberRevenueSummary } from '../../types/barberQueue';
import type {
  RestaurantReward,
  RestaurantStaffMember,
  RestaurantStaffRole,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { categoryLabels } from '../../config/reviewExperience';
import { BARBER_UI_MEDIA, resolveBarberPortrait } from '../../config/barberMedia';
import {
  getBarberQueueUrl,
  getBarberStaffUrl,
} from '../../utils/barberQueueValidation';
import {
  STAFF_ROLE_METADATA,
  formatPriceFromPaise,
  generateNextStaffCode,
  hashStaffPin,
  validateStaffPinFormat,
} from '../../utils/restaurantValidation';
import { loadBusinessQRSettings } from '../../services/qr/qrGenerator';
import { copyText } from '../../utils/clipboard';
import { BarberQueueManagerView } from '../dashboard/BarberQueueManagerView';
import { QRCodeManager } from '../dashboard/QRCodeManager';
import { GoogleUrlSettings } from '../dashboard/GoogleUrlSettings';
import { AIConfigurationSettings } from '../dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../dashboard/BusinessKnowledgeSettings';
import { CustomerDraftsView } from '../dashboard/CustomerDraftsView';
import { AnalyticsView } from '../dashboard/AnalyticsView';
import { BusinessCategorySettings } from '../dashboard/BusinessCategorySettings';
import { FaceShapeAnalyzer } from './FaceShapeAnalyzer';

export type BarberStudioTab =
  | 'overview'
  | 'live_queue'
  | 'shop_qr'
  | 'barbers'
  | 'face_shaper'
  | 'loyalty_reviews'
  | 'ai_reviews';

interface Props {
  business: Business;
  barberBusinesses: Business[];
  hasRestaurantBusinesses?: boolean;
  onSelectBusiness: (slug: string) => void;
  onBusinessUpdated: (updated: Business) => void;
  initialTab?: BarberStudioTab;
}

const BARBER_STAFF_ROLES: RestaurantStaffRole[] = [
  'barber',
  'manager',
  'cashier',
];

export function BarberOwnerWorkspace({
  business,
  barberBusinesses,
  hasRestaurantBusinesses = false,
  onSelectBusiness,
  onBusinessUpdated,
  initialTab = 'overview',
}: Props) {
  const [activeTab, setActiveTab] = useState<BarberStudioTab>(initialTab);
  const [aiSuiteSection, setAiSuiteSection] = useState<
    'drafts' | 'analytics' | 'settings'
  >('drafts');

  // Barber Team, Rewards & Analytics State
  const [staffMembers, setStaffMembers] = useState<RestaurantStaffMember[]>([]);
  const [rewards, setRewards] = useState<RestaurantReward[]>([]);
  const [revenueSummary, setRevenueSummary] =
    useState<BarberRevenueSummary | null>(null);
  const [waitingCount, setWaitingCount] = useState<number>(0);
  const [nextGuestWaitMins, setNextGuestWaitMins] = useState<number>(0);
  const [nowServingName, setNowServingName] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Barber form
  const [barberName, setBarberName] = useState('');
  const [barberRole, setBarberRole] = useState<RestaurantStaffRole>('barber');
  const [customCode, setCustomCode] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showAddPin, setShowAddPin] = useState(false);
  const [creatingBarber, setCreatingBarber] = useState(false);

  // Inline PIN reset
  const [resetTargetId, setResetTargetId] = useState<string | null>(null);
  const [resetPinInput, setResetPinInput] = useState('');
  const [savingPinId, setSavingPinId] = useState<string | null>(null);

  // Add Grooming Reward form
  const [rewardTitle, setRewardTitle] = useState('');
  const [rewardDesc, setRewardDesc] = useState('');
  const [rewardStars, setRewardStars] = useState('5');
  const [creatingReward, setCreatingReward] = useState(false);

  // Copy helper
  const [copiedBarberApp, setCopiedBarberApp] = useState(false);

  const currentStatus = business.status ?? 'pending';
  const currentAccountState = business.accountState ?? 'active';
  const isBusinessLive =
    currentStatus === 'active' && currentAccountState === 'active';

  const queueUrl = getBarberQueueUrl(business.slug);
  const barberStaffUrl = getBarberStaffUrl(business.slug);
  const uploadedShopLogo = loadBusinessQRSettings(business).logoDataUrl;

  useEffect(() => {
    let cancelled = false;
    async function loadStudioData() {
      try {
        const [
          staffList,
          rewardList,
          revSummary,
          queueStatus,
          bizMetrics,
          bizEvents,
          bizDrafts,
        ] = await Promise.all([
          businessRepository.getRestaurantStaffMembers(business.id),
          businessRepository.getRestaurantRewards(business.id),
          businessRepository
            .getBarberRevenueAndServiceSummary(business.id)
            .catch(() => null),
          businessRepository
            .getPublicBarberQueueStatus(business.slug)
            .catch(() => null),
          businessRepository.getMetrics(business.id),
          businessRepository.getEvents(business.id),
          businessRepository.getDrafts(business.id),
        ]);

        if (!cancelled) {
          setStaffMembers(staffList);
          setRewards(rewardList);
          if (revSummary) setRevenueSummary(revSummary);
          if (queueStatus) {
            setWaitingCount(queueStatus.waitingCount);
            setNextGuestWaitMins(queueStatus.estimatedWaitForNewGuestMinutes);
            setNowServingName(queueStatus.nowServing?.guestName ?? null);
          }
          setMetrics(bizMetrics);
          setEvents(bizEvents);
          setDrafts(bizDrafts);
        }
      } catch {
        // non-blocking
      }
    }
    void loadStudioData();
    return () => {
      cancelled = true;
    };
  }, [business.id, business.slug]);

  function showToast(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(null), 4500);
  }

  function showErr(msg: string) {
    setStatusMessage(null);
    setErrorMessage(msg);
  }

  async function handleCopyBarberAppUrl() {
    const ok = await copyText(barberStaffUrl);
    if (ok) {
      setCopiedBarberApp(true);
      window.setTimeout(() => setCopiedBarberApp(false), 2000);
    }
  }

  const nextSuggestedCode = generateNextStaffCode(
    barberRole,
    staffMembers.map((m) => m.staffCode),
  );

  async function handleCreateBarber(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);
    const cleanName = barberName.trim();
    if (cleanName.length < 2) {
      showErr('Please enter the barber name (at least 2 characters).');
      return;
    }
    const pinCheck = validateStaffPinFormat(pinInput);
    if (!pinCheck.ok) {
      showErr(pinCheck.error);
      return;
    }
    setCreatingBarber(true);
    try {
      const pinHash = await hashStaffPin(business.slug, pinCheck.pin);
      const created = await businessRepository.createRestaurantStaffMember(
        business.id,
        {
          fullName: cleanName,
          role: barberRole,
          staffCode: customCode.trim() || nextSuggestedCode,
          pinHash,
          isActive: true,
        },
      );
      setStaffMembers((prev) => [...prev, created]);
      setBarberName('');
      setCustomCode('');
      setPinInput('');
      showToast(
        `Added ${created.fullName} (${created.staffCode}) — ready to sign into Barber Chair App.`,
      );
    } catch (err) {
      showErr((err as Error).message);
    } finally {
      setCreatingBarber(false);
    }
  }

  async function handleToggleBarberActive(member: RestaurantStaffMember) {
    try {
      const updated = await businessRepository.updateRestaurantStaffMember(
        business.id,
        member.id,
        {
          fullName: member.fullName,
          role: member.role,
          staffCode: member.staffCode,
          isActive: !member.isActive,
        },
      );
      setStaffMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
      showToast(
        `${updated.fullName} (${updated.staffCode}) is now ${updated.isActive ? 'active' : 'paused'}.`,
      );
    } catch (err) {
      showErr((err as Error).message);
    }
  }

  async function handleSaveResetPin(member: RestaurantStaffMember) {
    const pinCheck = validateStaffPinFormat(resetPinInput);
    if (!pinCheck.ok) {
      showErr(pinCheck.error);
      return;
    }
    setSavingPinId(member.id);
    try {
      const pinHash = await hashStaffPin(business.slug, pinCheck.pin);
      const updated = await businessRepository.updateRestaurantStaffMember(
        business.id,
        member.id,
        {
          fullName: member.fullName,
          role: member.role,
          staffCode: member.staffCode,
          isActive: member.isActive,
          pinHash,
        },
      );
      setStaffMembers((prev) =>
        prev.map((m) => (m.id === updated.id ? updated : m)),
      );
      setResetTargetId(null);
      setResetPinInput('');
      showToast(`Updated personal PIN for ${member.fullName} (${member.staffCode}).`);
    } catch (err) {
      showErr((err as Error).message);
    } finally {
      setSavingPinId(null);
    }
  }

  async function handleDeleteBarber(member: RestaurantStaffMember) {
    try {
      await businessRepository.deleteRestaurantStaffMember(business.id, member.id);
      setStaffMembers((prev) => prev.filter((m) => m.id !== member.id));
      showToast(`Removed ${member.fullName} (${member.staffCode}).`);
    } catch (err) {
      showErr((err as Error).message);
    }
  }

  async function handleCreateReward(e: React.FormEvent) {
    e.preventDefault();
    const cleanTitle = rewardTitle.trim();
    const starsNum = Number.parseInt(rewardStars, 10);
    if (cleanTitle.length < 2) {
      showErr('Please enter a reward title (e.g. Free Beard Trim).');
      return;
    }
    if (!Number.isInteger(starsNum) || starsNum < 1 || starsNum > 100) {
      showErr('Stars required must be between 1 and 100.');
      return;
    }
    setCreatingReward(true);
    try {
      const created = await businessRepository.createRestaurantReward(
        business.id,
        {
          title: cleanTitle,
          description: rewardDesc.trim() || 'Redeemable at the barber chair',
          starsRequired: starsNum,
          isActive: true,
          displayOrder: rewards.length + 1,
        },
      );
      setRewards((prev) => [...prev, created]);
      setRewardTitle('');
      setRewardDesc('');
      setRewardStars('5');
      showToast(`Added grooming reward "${created.title}" (${created.starsRequired} ★).`);
    } catch (err) {
      showErr((err as Error).message);
    } finally {
      setCreatingReward(false);
    }
  }

  async function handleDeleteReward(reward: RestaurantReward) {
    try {
      await businessRepository.deleteRestaurantReward(business.id, reward.id);
      setRewards((prev) => prev.filter((r) => r.id !== reward.id));
      showToast(`Removed reward "${reward.title}".`);
    } catch (err) {
      showErr((err as Error).message);
    }
  }

  const statusPillConfig: Record<
    NonNullable<Business['status']>,
    { label: string; className: string; Icon: typeof CheckCircle2 }
  > = {
    pending: {
      label: 'Awaiting Approval',
      className: 'bg-[#F59E0B]/15 text-[#F59E0B] border-[#F59E0B]/40',
      Icon: Clock,
    },
    active: {
      label: 'Live & Active',
      className: 'bg-[#22C55E]/15 text-[#22C55E] border-[#22C55E]/35',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-[#EF4444]/15 text-[#EF4444] border-[#EF4444]/40',
      Icon: Ban,
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-white/10 text-[#B5B5BC] border-[#303239]',
      Icon: ShieldAlert,
    },
  };

  const currentPill = statusPillConfig[currentStatus];
  const StatusIcon = currentPill.Icon;

  const navItems: {
    id: BarberStudioTab;
    label: string;
    shortLabel: string;
    Icon: typeof Scissors;
  }[] = [
    {
      id: 'overview',
      label: 'Studio Overview',
      shortLabel: 'Overview',
      Icon: LayoutDashboard,
    },
    {
      id: 'live_queue',
      label: 'Live Queue & Timer',
      shortLabel: 'Live Queue',
      Icon: Scissors,
    },
    {
      id: 'shop_qr',
      label: 'Shop Entrance QR',
      shortLabel: 'Shop QR',
      Icon: QrCode,
    },
    {
      id: 'barbers',
      label: 'Barbers & Chair PINs',
      shortLabel: 'Barbers',
      Icon: Users,
    },
    {
      id: 'face_shaper',
      label: 'Style AI (Face Shaper)',
      shortLabel: 'Style AI',
      Icon: ScanFace,
    },
    {
      id: 'loyalty_reviews',
      label: 'Loyalty Rewards',
      shortLabel: 'Rewards',
      Icon: Star,
    },
    {
      id: 'ai_reviews',
      label: 'AI Reviews & Funnel',
      shortLabel: 'AI Reviews',
      Icon: MessageSquareQuote,
    },
  ];

  const serviceBreakdown = revenueSummary?.serviceBreakdown ?? [];
  const topServiceRevenue = serviceBreakdown.reduce(
    (max, r) => Math.max(max, r.revenueMonthPaise),
    0,
  );

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start animate-fadeSlideUp">
      {/* CLIPAURA OBSIDIAN SIDEBAR (#101114 / #17181C + #D5A63C) */}
      <aside
        aria-label="ClipAura Barber Queue Studio Navigation"
        className="lg:col-span-3 overflow-hidden rounded-3xl border border-[#303239] bg-[#101114] text-[#F5F5F6] shadow-lg flex flex-col justify-between lg:sticky lg:top-6"
      >
        <div>
          {/* Brushed Gold Accent Line */}
          <div className="h-1 w-full bg-gradient-to-r from-[#D5A63C] via-[#F2C45B] to-[#D5A63C]" />

          <div className="p-5 space-y-5">
            {/* Business Brand Logo / ClipAura Studio Identity */}
            <div className="flex items-center justify-between gap-2 border-b border-[#303239] pb-4">
              <div className="flex items-center gap-3 min-w-0">
                {uploadedShopLogo ? (
                  <img
                    src={uploadedShopLogo}
                    alt={`${business.name} logo`}
                    className="h-10 w-10 shrink-0 rounded-xl border border-[#303239] bg-[#17181C] object-contain p-0.5"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#D5A63C]/40 bg-[#17181C] text-[#F2C45B]">
                    <Scissors className="h-5 w-5" aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#D5A63C]">
                    CLIPAURA STUDIO
                  </p>
                  <p className="truncate text-[14px] font-black text-[#F5F5F6]">
                    {business.name}
                  </p>
                </div>
              </div>
              <Link
                to="/setup?type=barber"
                className="inline-flex items-center gap-1 rounded-lg border border-[#303239] bg-[#202127] px-2.5 py-1 text-[11px] font-bold text-[#F2C45B] hover:border-[#D5A63C]"
              >
                <Plus className="h-3 w-3" aria-hidden /> New
              </Link>
            </div>

            {/* Active Barber Shop Selector */}
            <div className="space-y-1.5">
              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-[#B5B5BC]">
                Active Barber Shop / Salon
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-[#303239] bg-[#17181C] px-3">
                <Building2
                  className="h-4 w-4 shrink-0 text-[#D5A63C]"
                  aria-hidden
                />
                <select
                  aria-label="Select active barber shop"
                  value={business.slug}
                  onChange={(e) => onSelectBusiness(e.target.value)}
                  className="w-full min-w-0 truncate bg-transparent text-[13px] font-bold text-[#F5F5F6] focus:outline-none cursor-pointer"
                >
                  {barberBusinesses.map((b) => (
                    <option
                      key={b.id}
                      value={b.slug}
                      className="bg-[#101114] text-[#F5F5F6]"
                    >
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Navigation List */}
            <nav className="flex overflow-x-auto lg:flex-col gap-1.5 pb-1 lg:pb-0">
              {navItems.map(({ id, label, shortLabel, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13px] font-bold whitespace-nowrap transition-colors cursor-pointer ${
                      isActive
                        ? 'bg-[#D5A63C] text-[#101114] shadow-sm'
                        : 'text-[#B5B5BC] hover:bg-[#202127] hover:text-[#F5F5F6]'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-[#101114]' : 'text-[#D5A63C]'
                      }`}
                      aria-hidden
                    />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </button>
                );
              })}
            </nav>
          </div>
        </div>

        {/* Footer: Shop Status & Quick Portal Links */}
        <div className="border-t border-[#303239] p-5 space-y-3 bg-[#17181C]">
          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${currentPill.className}`}
            >
              <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
              {currentPill.label}
            </span>
            <span className="text-[11px] text-[#B5B5BC] truncate">
              {business.city}
            </span>
          </div>

          {isBusinessLive && (
            <div className="grid grid-cols-2 gap-2">
              <a
                href={queueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#D5A63C]/40 bg-[#202127] px-2 text-[11.5px] font-bold text-[#F2C45B] hover:bg-[#D5A63C] hover:text-[#101114] transition-colors"
              >
                Customer App <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <a
                href={barberStaffUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#303239] bg-[#101114] px-2 text-[11.5px] font-bold text-[#F5F5F6] hover:border-[#D5A63C] transition-colors"
              >
                Chair App <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          )}

          {hasRestaurantBusinesses && (
            <div className="pt-2 border-t border-[#303239]">
              <Link
                to="/dashboard?view=restaurant"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#B5B5BC] hover:text-[#F2C45B]"
              >
                Switch to Restaurant BistroOS →
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN STUDIO WORKSPACE (#F5F6F8 + #FFFFFF cards) */}
      <div className="lg:col-span-9 min-w-0 rounded-3xl border border-[#E4E5E8] bg-[#F5F6F8] p-4 sm:p-6 space-y-5">
        {!isBusinessLive && (
          <div
            role="status"
            className="rounded-2xl border border-[#F59E0B]/40 bg-amber-50 p-4 space-y-1"
          >
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4.5 w-4.5 text-[#F59E0B]" aria-hidden />
              <h2 className="text-[14.5px] font-extrabold text-[#18191C]">
                {currentStatus === 'pending'
                  ? 'Shop in Preview Mode — Awaiting Barber Admin Approval'
                  : 'Public Live Queue Offline'}
              </h2>
            </div>
            <p className="text-[12.5px] text-[#5D626A]">
              Configure your services, barbers &amp; PINs, and grooming rewards below. Once approved under{' '}
              <Link to="/admin" className="font-bold text-[#18191C] underline">
                Admin Panel
              </Link>
              , your public queue and QR unlock immediately.
            </p>
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-2xl border border-[#22C55E]/30 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-2xl border border-[#EF4444]/30 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* ================= TAB 0: STUDIO OVERVIEW (CLIPAURA DESIGN) ================= */}
        {activeTab === 'overview' && (
          <div className="space-y-5">
            {/* Compact Top Header Strip */}
            <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-4 sm:p-5">
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-[22px] sm:text-[26px] font-black tracking-tight text-[#18191C]">
                    {business.name}
                  </h1>
                  <span className="rounded-md bg-[#101114] px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#F2C45B]">
                    {categoryLabels[business.category]}
                  </span>
                </div>
                <p className="text-[13px] text-[#5D626A] mt-0.5">
                  {nowServingName
                    ? `Currently in chair: ${nowServingName} · ${waitingCount} guest${waitingCount === 1 ? '' : 's'} waiting (~${nextGuestWaitMins}m wait)`
                    : `Chairs open & ready · ${waitingCount} waiting (~${nextGuestWaitMins}m wait)`}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('live_queue')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#101114] px-4 text-[13px] font-extrabold text-[#F2C45B] hover:bg-[#202127] cursor-pointer"
                >
                  <Scissors className="h-4 w-4" aria-hidden />
                  Open Live Chair Queue
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('face_shaper')}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E4E5E8] bg-[#FFFFFF] px-3.5 text-[13px] font-bold text-[#18191C] hover:border-[#D5A63C] cursor-pointer"
                >
                  <ScanFace className="h-4 w-4 text-[#D5A63C]" aria-hidden />
                  Style AI
                </button>
              </div>
            </header>

            {/* 4 Clean Data Metric Cards (Zero decorative images in metrics per Rule 4) */}
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-4 space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5D626A] flex items-center justify-between">
                  Today&apos;s Cuts
                  <Scissors className="h-4 w-4 text-[#D5A63C]" aria-hidden />
                </span>
                <p className="text-[28px] font-black text-[#18191C] tabular-nums">
                  {revenueSummary?.todayTotalCuts ?? 0}
                </p>
                <p className="text-[11.5px] text-[#5D626A]">
                  {revenueSummary?.todayWalkIns ?? 0} walk-in · {revenueSummary?.todayAppointments ?? 0} booked
                </p>
              </div>

              <div className="rounded-2xl border border-[#303239] bg-[#101114] p-4 space-y-1 text-[#F5F5F6]">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D5A63C] flex items-center justify-between">
                  Today&apos;s Revenue
                  <IndianRupee className="h-4 w-4 text-[#F2C45B]" aria-hidden />
                </span>
                <p className="text-[28px] font-black text-[#FFFFFF] tabular-nums">
                  {formatPriceFromPaise(revenueSummary?.todayRevenuePaise ?? 0, 'INR')}
                </p>
                <p className="text-[11.5px] text-[#B5B5BC]">Auto-logged on completion</p>
              </div>

              <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-4 space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5D626A] flex items-center justify-between">
                  Waiting In Queue
                  <Clock className="h-4 w-4 text-[#3B82F6]" aria-hidden />
                </span>
                <p className="text-[28px] font-black text-[#18191C] tabular-nums">
                  {waitingCount}
                </p>
                <p className="text-[11.5px] text-[#5D626A]">
                  Est. {nextGuestWaitMins} mins for next guest
                </p>
              </div>

              <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-4 space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#5D626A] flex items-center justify-between">
                  Month Revenue
                  <TrendingUp className="h-4 w-4 text-[#22C55E]" aria-hidden />
                </span>
                <p className="text-[28px] font-black text-[#18191C] tabular-nums">
                  {formatPriceFromPaise(revenueSummary?.monthRevenuePaise ?? 0, 'INR')}
                </p>
                <p className="text-[11.5px] text-[#5D626A]">
                  {revenueSummary?.monthTotalCuts ?? 0} total cuts this month
                </p>
              </div>
            </div>

            {/* 2-Column Analytical & Operations Split */}
            <div className="grid gap-5 lg:grid-cols-12">
              {/* Service Breakdown Bars (Analytics Rule: pure chart bars, zero photos) */}
              <div className="lg:col-span-7 rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-black text-[#18191C]">
                      Service Revenue Breakdown
                    </h2>
                    <p className="text-[12px] text-[#5D626A]">
                      This month&apos;s top performing cuts &amp; combos
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('live_queue')}
                    className="text-[12px] font-bold text-[#18191C] hover:text-[#D5A63C] cursor-pointer"
                  >
                    Full Ledger →
                  </button>
                </div>

                {serviceBreakdown.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-[#E4E5E8] bg-[#F5F6F8] p-6 text-center space-y-2">
                    <img
                      src={BARBER_UI_MEDIA.icons.checklist}
                      alt="No completed cuts logged yet"
                      className="mx-auto h-14 w-14 rounded-xl object-cover"
                      loading="lazy"
                    />
                    <p className="text-[13px] font-bold text-[#18191C]">
                      No cuts completed yet this month
                    </p>
                    <p className="text-[12px] text-[#5D626A]">
                      Complete a ticket in Live Queue Timer to populate real revenue bars here.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {serviceBreakdown.slice(0, 5).map((row) => {
                      const pct =
                        topServiceRevenue > 0
                          ? Math.max(8, Math.round((row.revenueMonthPaise / topServiceRevenue) * 100))
                          : 0;
                      return (
                        <div key={row.serviceName} className="space-y-1">
                          <div className="flex items-center justify-between text-[13px] font-bold">
                            <span className="text-[#18191C]">{row.serviceName}</span>
                            <span className="text-[#5D626A] tabular-nums">
                              {row.countMonth} cuts ·{' '}
                              <strong className="text-[#18191C]">
                                {formatPriceFromPaise(row.revenueMonthPaise, 'INR')}
                              </strong>
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-[#F5F6F8]">
                            <div
                              className="h-full rounded-full bg-[#D5A63C]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Active Barber Roster Summary (Small 1:1 portraits per Rule 4) */}
              <div className="lg:col-span-5 rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h2 className="text-[16px] font-black text-[#18191C]">
                    Active Barber Team ({staffMembers.filter((m) => m.isActive).length})
                  </h2>
                  <button
                    type="button"
                    onClick={() => setActiveTab('barbers')}
                    className="text-[12px] font-bold text-[#D5A63C] hover:underline cursor-pointer"
                  >
                    Manage PINs →
                  </button>
                </div>

                {staffMembers.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-[#E4E5E8] bg-[#F5F6F8] p-4 text-[12.5px] text-[#5D626A]">
                    No barbers added yet. Add your stylists so each chair can track timers independently.
                  </p>
                ) : (
                  <div className="space-y-2.5">
                    {staffMembers.slice(0, 4).map((member) => (
                      <div
                        key={member.id}
                        className="flex items-center justify-between gap-3 rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] p-2.5"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <img
                            src={resolveBarberPortrait(member.staffCode)}
                            alt={member.fullName}
                            className="h-9 w-9 shrink-0 rounded-full object-cover border border-[#D5A63C]/40"
                            loading="lazy"
                          />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-extrabold text-[#18191C]">
                              {member.fullName}
                            </p>
                            <p className="font-mono text-[11px] font-bold text-[#5D626A]">
                              {member.staffCode} · {STAFF_ROLE_METADATA[member.role]?.label ?? 'Barber'}
                            </p>
                          </div>
                        </div>
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-extrabold ${
                            member.isActive
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {member.isActive ? 'On Chair' : 'Paused'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Bottom Row: Compact Style AI Promo Card (negative-space photo) + AI Review Funnel Card */}
            <div className="grid gap-5 lg:grid-cols-12">
              <div className="lg:col-span-7 relative overflow-hidden rounded-2xl border border-[#303239] bg-[#101114] aspect-[16/9] sm:aspect-auto sm:min-h-[210px]">
                <img
                  src={BARBER_UI_MEDIA.banners.heroDarkSpace}
                  alt="ClipAura Chair Consultation"
                  className="absolute inset-0 h-full w-full object-cover opacity-90"
                  loading="lazy"
                />
                <div className="absolute inset-0 bg-gradient-to-r from-[#101114] via-[#101114]/85 to-transparent" />
                <div className="relative z-10 flex h-full max-w-sm flex-col justify-between p-5 text-[#F5F5F6]">
                  <div className="space-y-1.5">
                    <span className="inline-flex items-center gap-1 rounded-md bg-[#D5A63C] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#101114]">
                      New Consultation Tool
                    </span>
                    <h3 className="text-[19px] font-black leading-snug">
                      AI Face Shape &amp; Style Recommender
                    </h3>
                    <p className="text-[12px] text-[#B5B5BC]">
                      Analyze any guest&apos;s face structure at the chair and suggest their ideal fade &amp; beard trim.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('face_shaper')}
                    className="mt-3 inline-flex h-9 w-fit items-center gap-1.5 rounded-xl bg-[#D5A63C] px-4 text-[12.5px] font-extrabold text-[#101114] hover:bg-[#F2C45B] cursor-pointer"
                  >
                    Launch Style AI <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5 rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 flex flex-col justify-between space-y-4">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#D5A63C]">
                      AI Reviews &amp; Growth Funnel
                    </span>
                    <BarChart3 className="h-4 w-4 text-[#5D626A]" aria-hidden />
                  </div>
                  <h3 className="text-[17px] font-black text-[#18191C]">
                    Customer Google Reviews
                  </h3>
                  <p className="text-[12px] text-[#5D626A]">
                    Drafts synthesized automatically after cuts complete.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5 text-center">
                  <div className="rounded-xl bg-[#F5F6F8] p-2.5">
                    <p className="text-[18px] font-black text-[#18191C] tabular-nums">
                      {metrics.qrScans}
                    </p>
                    <p className="text-[11px] font-bold text-[#5D626A]">Portal Visits</p>
                  </div>
                  <div className="rounded-xl bg-[#F5F6F8] p-2.5">
                    <p className="text-[18px] font-black text-[#18191C] tabular-nums">
                      {metrics.googleRedirectClicks}
                    </p>
                    <p className="text-[11px] font-bold text-[#5D626A]">Google Clicks</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setActiveTab('ai_reviews')}
                  className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#101114] px-4 text-[12.5px] font-extrabold text-[#F5F5F6] hover:bg-[#202127] cursor-pointer"
                >
                  Open AI Drafts &amp; Funnel ({drafts.length}) →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ================= TAB 1: LIVE CHAIR & TIMER BROADCAST ================= */}
        {activeTab === 'live_queue' && (
          <BarberQueueManagerView
            key={`barber-studio-live-${business.id}`}
            business={business}
            isBusinessLive={isBusinessLive}
            mode="owner"
          />
        )}

        {/* ================= TAB 2: SHOP ENTRANCE LIVE QUEUE QR STANDEE ================= */}
        {activeTab === 'shop_qr' && (
          <div className="space-y-5">
            <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-6 space-y-3">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1.5">
                  <div className="inline-flex items-center gap-1.5 rounded-full bg-[#101114] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#F2C45B]">
                    <QrCode className="h-3.5 w-3.5" aria-hidden />
                    Two-Step Barber QR Flow
                  </div>
                  <h1 className="text-[22px] font-black tracking-tight text-[#18191C]">
                    Shop Entrance Live Queue QR Standee
                  </h1>
                  <p className="text-[13px] text-[#5D626A] leading-relaxed max-w-2xl">
                    Place this Shop Entrance QR at your reception desk or mirror station. Guests scan to claim their live Token QR &amp; countdown timer synced in real time with your chair app.
                  </p>
                </div>
                <img
                  src={BARBER_UI_MEDIA.banners.shopHero}
                  alt="ClipAura shop interior cover"
                  className="h-24 w-full sm:w-44 shrink-0 rounded-xl object-cover border border-[#E4E5E8]"
                  loading="lazy"
                />
              </div>
            </div>

            {isBusinessLive ? (
              <QRCodeManager
                key={`barber-qr-${business.id}`}
                business={business}
                defaultMode="barber_queue"
              />
            ) : (
              <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-10 text-center space-y-3">
                <Clock className="mx-auto h-8 w-8 text-[#D5A63C]" aria-hidden />
                <h3 className="text-[18px] font-extrabold text-[#18191C]">
                  Shop Entrance QR Unlocks After Approval
                </h3>
                <p className="mx-auto max-w-md text-[13px] text-[#5D626A]">
                  Approve <strong>{business.name}</strong> in Admin Panel →{' '}
                  <strong>Barber &amp; Salon Approvals</strong> to download your printable Live Queue QR Standee (PNG &amp; A5 PDF).
                </p>
              </div>
            )}
          </div>
        )}

        {/* ================= TAB 3: BARBERS & PERSONAL CHAIR PINS ================= */}
        {activeTab === 'barbers' && (
          <div className="space-y-5">
            {/* Barber Chair Mobile App Quick Link */}
            <div className="overflow-hidden rounded-2xl border border-[#303239] bg-[#101114] text-[#F5F5F6] shadow-md">
              <div className="h-1 w-full bg-gradient-to-r from-[#D5A63C] via-[#F2C45B] to-[#D5A63C]" />
              <div className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#D5A63C]">
                    CHAIR MOBILE APP FOR YOUR BARBERS
                  </p>
                  <h2 className="text-[19px] font-black text-[#FFFFFF]">
                    Let Each Barber Update Timers From Their Phone
                  </h2>
                  <p className="text-[13px] text-[#B5B5BC]">
                    Share this link with your team. Each barber signs in with ID (e.g.{' '}
                    <strong className="text-[#F2C45B]">BAR-01</strong>) &amp; PIN.
                  </p>
                  <p className="font-mono text-[12px] text-[#F2C45B] break-all pt-1">
                    {barberStaffUrl}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyBarberAppUrl()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#D5A63C] px-4 text-[13px] font-extrabold text-[#101114] hover:bg-[#F2C45B] cursor-pointer"
                  >
                    {copiedBarberApp ? (
                      <Check className="h-4 w-4" aria-hidden />
                    ) : (
                      <Copy className="h-4 w-4" aria-hidden />
                    )}
                    {copiedBarberApp ? 'Copied' : 'Copy Chair App Link'}
                  </button>
                  {isBusinessLive && (
                    <a
                      href={barberStaffUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#303239] bg-[#202127] px-4 text-[13px] font-bold text-[#F5F5F6] hover:border-[#D5A63C]"
                    >
                      Open App <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Add Barber Form (Data-focused per Rule 11 — no giant photos) */}
            <form
              onSubmit={(e) => void handleCreateBarber(e)}
              className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 sm:p-6 space-y-4"
            >
              <div>
                <h2 className="text-[17px] font-extrabold text-[#18191C] flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#D5A63C]" aria-hidden />
                  Add Barber / Stylist &amp; Personal PIN
                </h2>
                <p className="text-[12.5px] text-[#5D626A] mt-0.5">
                  Every timer extension and completed cut logs under the barber&apos;s personal staff code.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5D626A] mb-1">
                    Barber Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="e.g. Arjun"
                    value={barberName}
                    onChange={(e) => setBarberName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] px-3 text-[13.5px] font-semibold text-[#18191C] focus:border-[#D5A63C] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5D626A] mb-1">
                    Role
                  </label>
                  <select
                    value={barberRole}
                    onChange={(e) =>
                      setBarberRole(e.target.value as RestaurantStaffRole)
                    }
                    className="h-11 w-full rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] px-3 text-[13.5px] font-semibold text-[#18191C] focus:border-[#D5A63C] focus:bg-[#FFFFFF] focus:outline-none"
                  >
                    {BARBER_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {STAFF_ROLE_METADATA[r].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5D626A] mb-1">
                    Barber ID (Auto: {nextSuggestedCode})
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder={nextSuggestedCode}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    className="h-11 w-full rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] px-3 font-mono text-[13.5px] font-bold text-[#18191C] focus:border-[#D5A63C] focus:bg-[#FFFFFF] focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5D626A] mb-1">
                    4–6 Digit PIN
                  </label>
                  <div className="relative flex items-center">
                    <input
                      type={showAddPin ? 'text' : 'password'}
                      inputMode="numeric"
                      required
                      maxLength={6}
                      placeholder="e.g. 4321"
                      value={pinInput}
                      onChange={(e) =>
                        setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                      }
                      className="h-11 w-full rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] pl-3 pr-10 font-mono text-[14px] font-bold text-[#18191C] focus:border-[#D5A63C] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPin((v) => !v)}
                      aria-label={showAddPin ? 'Hide PIN' : 'Show PIN'}
                      className="absolute right-2.5 text-[#5D626A] hover:text-[#18191C] cursor-pointer"
                    >
                      {showAddPin ? (
                        <EyeOff className="h-4 w-4" aria-hidden />
                      ) : (
                        <Eye className="h-4 w-4" aria-hidden />
                      )}
                    </button>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={creatingBarber}
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#101114] px-5 text-[13.5px] font-extrabold text-[#F2C45B] hover:bg-[#202127] disabled:opacity-60 cursor-pointer"
              >
                <Plus className="h-4 w-4" aria-hidden />
                {creatingBarber ? 'Adding Barber…' : 'Add Barber to Roster'}
              </button>
            </form>

            {/* Barber Directory List (Small 1:1 avatars per Rule 11) */}
            <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 sm:p-6 space-y-3">
              <h3 className="text-[16px] font-extrabold text-[#18191C]">
                Active Barber Team ({staffMembers.length})
              </h3>
              {staffMembers.length === 0 ? (
                <p className="text-[13px] text-[#5D626A] py-4 text-center">
                  No barbers added yet. Add your first barber above (e.g. Arjun • BAR-01) so they can control the chair timer from their phone.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {staffMembers.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] p-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <img
                          src={resolveBarberPortrait(member.staffCode)}
                          alt={member.fullName}
                          className="h-10 w-10 shrink-0 rounded-full object-cover border border-[#D5A63C]/40"
                          loading="lazy"
                        />
                        <span className="inline-flex h-8 min-w-16 items-center justify-center rounded-lg bg-[#101114] px-2 font-mono text-[11.5px] font-extrabold text-[#F2C45B]">
                          {member.staffCode}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[14.5px] font-extrabold text-[#18191C] truncate">
                            {member.fullName}
                          </p>
                          <p className="text-[12px] font-semibold text-[#5D626A]">
                            {STAFF_ROLE_METADATA[member.role]?.label ?? 'Barber'} •{' '}
                            {member.isActive ? 'Active' : 'Paused'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleBarberActive(member)}
                          className={`h-9 rounded-lg border px-3 text-[12px] font-bold cursor-pointer ${
                            member.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-800'
                              : 'border-amber-200 bg-amber-50 text-amber-800'
                          }`}
                        >
                          {member.isActive ? 'Active' : 'Paused'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setResetTargetId(
                              resetTargetId === member.id ? null : member.id,
                            );
                            setResetPinInput('');
                          }}
                          className="inline-flex h-9 items-center gap-1 rounded-lg border border-[#E4E5E8] bg-[#FFFFFF] px-3 text-[12px] font-bold text-[#18191C] cursor-pointer"
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden />
                          Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBarber(member)}
                          aria-label={`Remove ${member.fullName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden />
                        </button>
                      </div>

                      {resetTargetId === member.id && (
                        <div className="w-full sm:w-auto flex items-center gap-2 pt-2 sm:pt-0">
                          <input
                            type="password"
                            inputMode="numeric"
                            maxLength={6}
                            placeholder="New 4–6 digit PIN"
                            value={resetPinInput}
                            onChange={(e) =>
                              setResetPinInput(
                                e.target.value.replace(/\D/g, '').slice(0, 6),
                              )
                            }
                            className="h-9 w-36 rounded-lg border border-[#E4E5E8] bg-[#FFFFFF] px-2.5 font-mono text-[13px] font-bold text-[#18191C]"
                          />
                          <button
                            type="button"
                            disabled={savingPinId === member.id}
                            onClick={() => void handleSaveResetPin(member)}
                            className="h-9 rounded-lg bg-[#101114] px-3 text-[12px] font-bold text-[#F2C45B] cursor-pointer"
                          >
                            Save
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 4: AI FACE SHAPER CONSULTATION STUDIO ================= */}
        {activeTab === 'face_shaper' && (
          <FaceShapeAnalyzer variant="studio" />
        )}

        {/* ================= TAB 5: GROOMING LOYALTY REWARDS ================= */}
        {activeTab === 'loyalty_reviews' && (
          <div className="space-y-5">
            {/* Compact Loyalty Landing Header with selective Trophy / Crown visuals (Rule 13) */}
            <div className="rounded-2xl border border-[#303239] bg-[#101114] p-5 text-[#F5F5F6] flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="flex items-center gap-4">
                <img
                  src={BARBER_UI_MEDIA.icons.crown}
                  alt="ClipAura VIP Crown"
                  className="h-14 w-14 shrink-0 rounded-2xl object-cover border border-[#D5A63C]/40"
                  loading="lazy"
                />
                <div>
                  <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-[#D5A63C]">
                    RETENTION &amp; REPEAT VISITS
                  </p>
                  <h2 className="text-[20px] font-black text-[#FFFFFF]">
                    Barber Loyalty Star Rewards
                  </h2>
                  <p className="text-[12.5px] text-[#B5B5BC]">
                    Regulars earn +1 Loyalty Star automatically when cuts complete. Milestones surface inside their live ticket pass.
                  </p>
                </div>
              </div>
              <img
                src={BARBER_UI_MEDIA.icons.trophy}
                alt="Loyalty milestone trophy"
                className="hidden sm:block h-14 w-14 shrink-0 rounded-2xl object-cover border border-[#303239]"
                loading="lazy"
              />
            </div>

            <div className="rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 sm:p-6 space-y-5">
              <form
                onSubmit={(e) => void handleCreateReward(e)}
                className="grid gap-3 sm:grid-cols-12 rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] p-4"
              >
                <input
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Reward title (e.g. Free Beard Trim)"
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                  className="sm:col-span-5 h-10 rounded-xl border border-[#E4E5E8] bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#18191C]"
                />
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Short note (optional)"
                  value={rewardDesc}
                  onChange={(e) => setRewardDesc(e.target.value)}
                  className="sm:col-span-3 h-10 rounded-xl border border-[#E4E5E8] bg-[#FFFFFF] px-3 text-[13px] text-[#18191C]"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rewardStars}
                  onChange={(e) => setRewardStars(e.target.value)}
                  aria-label="Stars required"
                  className="sm:col-span-2 h-10 rounded-xl border border-[#E4E5E8] bg-[#FFFFFF] px-3 text-[13px] font-bold text-[#18191C]"
                />
                <button
                  type="submit"
                  disabled={creatingReward}
                  className="sm:col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-[#101114] px-3 text-[12.5px] font-extrabold text-[#F2C45B] hover:bg-[#202127] cursor-pointer"
                >
                  <Award className="h-3.5 w-3.5" aria-hidden />
                  Add ★
                </button>
              </form>

              {rewards.length === 0 ? (
                <div className="py-6 text-center space-y-2.5">
                  <img
                    src={BARBER_UI_MEDIA.icons.gift}
                    alt="No rewards created yet"
                    className="mx-auto h-16 w-16 rounded-2xl object-cover"
                    loading="lazy"
                  />
                  <p className="text-[14px] font-extrabold text-[#18191C]">
                    No Grooming Rewards Yet
                  </p>
                  <p className="text-[12.5px] text-[#5D626A]">
                    Add rewards like &ldquo;Free Beard Trim (5 ★)&rdquo; or &ldquo;Complimentary Haircut (10 ★)&rdquo;.
                  </p>
                </div>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#D5A63C] px-2.5 py-0.5 text-[11px] font-extrabold text-[#101114]">
                          ★ {reward.starsRequired} Stars
                        </span>
                        <p className="mt-1.5 text-[14.5px] font-extrabold text-[#18191C] truncate">
                          {reward.title}
                        </p>
                        {reward.description && (
                          <p className="text-[12px] text-[#5D626A] truncate">
                            {reward.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReward(reward)}
                        aria-label={`Delete ${reward.title}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= TAB 6: AI REVIEWS, DRAFTS & CONVERSION FUNNEL ================= */}
        {activeTab === 'ai_reviews' && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-4 sm:p-5">
              <div>
                <h2 className="text-[19px] font-black text-[#18191C] flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-[#D5A63C]" aria-hidden />
                  AI Review Suite &amp; Conversion Funnel
                </h2>
                <p className="text-[12.5px] text-[#5D626A]">
                  Manage customer review drafts, Google URL routing, AI tone prompts, typography, and QR conversion metrics.
                </p>
              </div>
              <div className="inline-flex rounded-xl border border-[#E4E5E8] bg-[#F5F6F8] p-1">
                {(
                  [
                    ['drafts', `Drafts (${drafts.length})`],
                    ['analytics', 'Funnel Analytics'],
                    ['settings', 'Google & AI Settings'],
                  ] as const
                ).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setAiSuiteSection(key)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
                      aiSuiteSection === key
                        ? 'bg-[#101114] text-[#F2C45B]'
                        : 'text-[#5D626A] hover:text-[#18191C]'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {aiSuiteSection === 'drafts' && (
              <CustomerDraftsView
                business={business}
                drafts={drafts}
                onDraftUpdated={(updated) =>
                  setDrafts((prev) =>
                    prev.map((d) => (d.id === updated.id ? updated : d)),
                  )
                }
              />
            )}

            {aiSuiteSection === 'analytics' && (
              <AnalyticsView
                metrics={metrics}
                events={events}
                businessName={business.name}
              />
            )}

            {aiSuiteSection === 'settings' && (
              <div className="space-y-5">
                <GoogleUrlSettings
                  key={`barber-google-${business.id}`}
                  business={business}
                  onUpdated={onBusinessUpdated}
                />
                <BusinessCategorySettings
                  key={`barber-cat-${business.id}`}
                  business={business}
                  onUpdated={onBusinessUpdated}
                />
                <AIConfigurationSettings
                  key={`barber-ai-${business.id}`}
                  business={business}
                />
                <BusinessKnowledgeSettings
                  key={`barber-knowledge-${business.id}`}
                  business={business}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
