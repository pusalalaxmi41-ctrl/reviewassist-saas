import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
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
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  RestaurantReward,
  RestaurantStaffMember,
  RestaurantStaffRole,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { categoryLabels } from '../../config/reviewExperience';
import {
  getBarberQueueUrl,
  getBarberStaffUrl,
} from '../../utils/barberQueueValidation';
import {
  STAFF_ROLE_METADATA,
  generateNextStaffCode,
  hashStaffPin,
  validateStaffPinFormat,
} from '../../utils/restaurantValidation';
import { copyText } from '../../utils/clipboard';
import { BarberQueueManagerView } from '../dashboard/BarberQueueManagerView';
import { QRCodeManager } from '../dashboard/QRCodeManager';
import { GoogleUrlSettings } from '../dashboard/GoogleUrlSettings';
import { AIConfigurationSettings } from '../dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../dashboard/BusinessKnowledgeSettings';

export type BarberStudioTab = 'live_queue' | 'shop_qr' | 'barbers' | 'loyalty_reviews';

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
  initialTab = 'live_queue',
}: Props) {
  const [activeTab, setActiveTab] = useState<BarberStudioTab>(initialTab);

  // Barber Team & PINs state
  const [staffMembers, setStaffMembers] = useState<RestaurantStaffMember[]>([]);
  const [rewards, setRewards] = useState<RestaurantReward[]>([]);
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

  useEffect(() => {
    let cancelled = false;
    async function loadStudioSideData() {
      try {
        const [staffList, rewardList] = await Promise.all([
          businessRepository.getRestaurantStaffMembers(business.id),
          businessRepository.getRestaurantRewards(business.id),
        ]);
        if (!cancelled) {
          setStaffMembers(staffList);
          setRewards(rewardList);
        }
      } catch {
        // non-blocking
      }
    }
    void loadStudioSideData();
    return () => {
      cancelled = true;
    };
  }, [business.id]);

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
        `Added ${created.fullName} (${created.staffCode}) — ready to sign into Barber Chair App!`,
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
      label: 'Awaiting Barber Admin Approval',
      className: 'bg-amber-500/15 text-amber-300 border-amber-400/40',
      Icon: Clock,
    },
    active: {
      label: 'Live & Active',
      className: 'bg-emerald-500/15 text-emerald-300 border-emerald-400/40',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-500/15 text-red-300 border-red-400/40',
      Icon: Ban,
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-white/10 text-gray-300 border-white/20',
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
      id: 'live_queue',
      label: 'Live Chair & Timer',
      shortLabel: 'Live Timer',
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
      id: 'loyalty_reviews',
      label: 'Loyalty & Reviews',
      shortLabel: 'Loyalty',
      Icon: Star,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start animate-fadeSlideUp">
      {/* SEPARATE BARBERSHOP STUDIO SIDEBAR (Obsidian Charcoal + Brushed Brass Gold) */}
      <aside
        aria-label="Barber Queue Studio Navigation"
        className="lg:col-span-3 overflow-hidden rounded-3xl border border-[#111318]/20 bg-[#111318] text-[#FAF8F5] shadow-lg flex flex-col justify-between lg:min-h-[640px]"
      >
        <div>
          {/* Brushed Gold Top Accent */}
          <div className="h-1.5 w-full bg-gradient-to-r from-[#C89B3C] via-[#F3E3B8] to-[#C89B3C]" />

          <div className="p-5 space-y-5">
            {/* Brand Identity Badge — Clearly Separate from Restaurant BistroOS */}
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#C89B3C]/40 bg-[#1B1F27] text-[#F3E3B8]">
                  <Scissors className="h-4.5 w-4.5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C89B3C]">
                    QUEUE STUDIO
                  </p>
                  <p className="truncate text-[14px] font-black text-[#FFFFFF]">
                    Barber &amp; Salon App
                  </p>
                </div>
              </div>
              <Link
                to="/setup?type=barber"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-[#F3E3B8] hover:bg-white/10"
              >
                <Plus className="h-3 w-3" aria-hidden /> New
              </Link>
            </div>

            {/* Barber Shop Switcher */}
            <div className="space-y-1.5">
              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-[#A3A8B3]">
                Active Barber Shop / Salon
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-[#1B1F27] px-3">
                <Building2
                  className="h-4 w-4 shrink-0 text-[#C89B3C]"
                  aria-hidden
                />
                <select
                  aria-label="Select active barber shop"
                  value={business.slug}
                  onChange={(e) => onSelectBusiness(e.target.value)}
                  className="w-full min-w-0 truncate bg-transparent text-[13.5px] font-bold text-[#FFFFFF] focus:outline-none cursor-pointer"
                >
                  {barberBusinesses.map((b) => (
                    <option
                      key={b.id}
                      value={b.slug}
                      className="bg-[#111318] text-[#FFFFFF]"
                    >
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* 4 Pure Barber Studio Destinations (Zero Restaurant Items!) */}
            <nav className="flex overflow-x-auto lg:flex-col gap-1.5">
              {navItems.map(({ id, label, shortLabel, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-[13.5px] font-bold whitespace-nowrap transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                      isActive
                        ? 'bg-[#C89B3C] text-[#111318] shadow-sm'
                        : 'text-[#D1D5DB] hover:bg-white/5 hover:text-[#FFFFFF]'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-[#111318]' : 'text-[#C89B3C]'
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

        {/* Footer: Shop Status + Live Customer Queue Link + Optional Switch to Restaurants */}
        <div className="border-t border-white/10 p-5 space-y-3 bg-[#0C0E12]">
          <div className="space-y-1">
            <p className="truncate text-[14px] font-extrabold text-[#FFFFFF]">
              {business.name}
            </p>
            <p className="truncate text-[12px] text-[#A3A8B3]">
              {categoryLabels[business.category]} • {business.city}
            </p>
          </div>

          <span
            className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${currentPill.className}`}
          >
            <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
            {currentPill.label}
          </span>

          {isBusinessLive && (
            <div className="grid grid-cols-2 gap-2 pt-1">
              <a
                href={queueUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-[#C89B3C]/40 bg-[#1B1F27] px-2 text-[11.5px] font-bold text-[#F3E3B8] hover:bg-[#C89B3C] hover:text-[#111318] transition-colors"
              >
                Customer QR <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
              <a
                href={barberStaffUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center justify-center gap-1 rounded-xl border border-white/15 bg-white/5 px-2 text-[11.5px] font-bold text-[#FFFFFF] hover:bg-white/15 transition-colors"
              >
                Chair App <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          )}

          {hasRestaurantBusinesses && (
            <div className="pt-2 border-t border-white/10">
              <Link
                to="/dashboard?view=restaurant"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-[#A3A8B3] hover:text-[#F3E3B8]"
              >
                Switch to Restaurant BistroOS →
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN BARBER STUDIO CONTENT */}
      <div className="lg:col-span-9 min-w-0 space-y-5">
        {!isBusinessLive && (
          <div
            role="status"
            className="rounded-3xl border border-amber-300 bg-amber-50 p-5 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4.5 w-4.5 text-[#D97706]" aria-hidden />
              <h2 className="text-[15px] font-extrabold text-[#111318]">
                {currentStatus === 'pending'
                  ? 'Shop in Preview Mode — Awaiting Barber Admin Approval'
                  : 'Public Live Queue Offline'}
              </h2>
            </div>
            <p className="text-[13px] text-[#5C6068]">
              Set up your chair timer services, barbers &amp; PINs, and grooming
              rewards below. Once approved under{' '}
              <strong>Barber &amp; Salon Approvals</strong> in{' '}
              <Link to="/admin" className="font-bold text-[#111318] underline">
                Admin Panel
              </Link>
              , your customer Live Queue QR unlocks instantly.
            </p>
          </div>
        )}

        {statusMessage && (
          <div
            role="status"
            className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-[#059669]"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div
            role="alert"
            className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
          >
            <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* TAB 1: LIVE CHAIR & TIMER BROADCAST */}
        {activeTab === 'live_queue' && (
          <BarberQueueManagerView
            key={`barber-studio-live-${business.id}`}
            business={business}
            isBusinessLive={isBusinessLive}
            mode="owner"
          />
        )}

        {/* TAB 2: SHOP ENTRANCE LIVE QUEUE QR STANDEE */}
        {activeTab === 'shop_qr' && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-6 shadow-xs space-y-2">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-[#111318] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#F3E3B8]">
                <QrCode className="h-3.5 w-3.5" aria-hidden />
                Two-Step Barber QR Flow
              </div>
              <h1 className="text-[24px] font-black tracking-tight text-[#111318]">
                Shop Entrance Live Queue QR Standee
              </h1>
              <p className="text-[13.5px] text-[#5C6068] leading-relaxed">
                <strong>Step 1:</strong> Place this Shop Entrance QR at your door
                or waiting bench. <strong>Step 2:</strong> When a walk-in guest
                scans it, they automatically receive their own{' '}
                <strong>Personal Check-In Token QR &amp; Live Countdown Timer</strong>{' '}
                that updates whenever you tap +5 / +10 / +15 mins in your Live
                Chair app.
              </p>
            </div>

            {isBusinessLive ? (
              <QRCodeManager
                key={`barber-qr-${business.id}`}
                business={business}
                defaultMode="barber_queue"
              />
            ) : (
              <div className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-10 text-center space-y-3">
                <Clock className="mx-auto h-8 w-8 text-[#C89B3C]" aria-hidden />
                <h3 className="text-[18px] font-extrabold text-[#111318]">
                  Shop Entrance QR Unlocks After Approval
                </h3>
                <p className="mx-auto max-w-md text-[13.5px] text-[#5C6068]">
                  Approve <strong>{business.name}</strong> in Admin Panel →{' '}
                  <strong>Barber &amp; Salon Approvals</strong> to download your
                  printable Live Queue QR Standee (PNG &amp; A5 PDF).
                </p>
              </div>
            )}
          </div>
        )}

        {/* TAB 3: BARBERS & PERSONAL CHAIR PINS */}
        {activeTab === 'barbers' && (
          <div className="space-y-6">
            {/* Barber Chair Mobile App Quick Link */}
            <div className="overflow-hidden rounded-3xl border border-[#C89B3C]/40 bg-[#111318] text-[#FAF8F5] shadow-md">
              <div className="h-1.5 w-full bg-gradient-to-r from-[#C89B3C] via-[#F3E3B8] to-[#C89B3C]" />
              <div className="p-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-[11px] font-extrabold uppercase tracking-[0.16em] text-[#C89B3C]">
                    CHAIR MOBILE APP FOR YOUR BARBERS
                  </p>
                  <h2 className="text-[20px] font-black text-[#FFFFFF]">
                    Let Each Barber Update Timers From Their Phone
                  </h2>
                  <p className="text-[13px] text-[#A3A8B3]">
                    Share this link with your barbers. They unlock with their
                    personal ID (e.g. <strong className="text-[#F3E3B8]">BAR-01</strong>)
                    &amp; PIN to call guests, broadcast +5/+10m delays, and award Loyalty Stars.
                  </p>
                  <p className="font-mono text-[12px] text-[#F3E3B8] break-all pt-1">
                    {barberStaffUrl}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => void handleCopyBarberAppUrl()}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#C89B3C] px-4 text-[13px] font-extrabold text-[#111318] hover:bg-[#D9AC4D] cursor-pointer"
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
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-white/20 bg-white/5 px-4 text-[13px] font-bold text-[#FFFFFF] hover:bg-white/15"
                    >
                      Open App <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                    </a>
                  )}
                </div>
              </div>
            </div>

            {/* Add Barber Form */}
            <form
              onSubmit={(e) => void handleCreateBarber(e)}
              className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-6 shadow-xs space-y-4"
            >
              <div>
                <h2 className="text-[18px] font-extrabold text-[#111318] flex items-center gap-2">
                  <Users className="h-5 w-5 text-[#C89B3C]" aria-hidden />
                  Add Barber / Stylist &amp; Personal PIN
                </h2>
                <p className="text-[13px] text-[#5C6068] mt-0.5">
                  Every timer extension and completed cut is logged under the barber&apos;s personal ID.
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C6068] mb-1">
                    Barber Name
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={60}
                    placeholder="e.g. Arjun"
                    value={barberName}
                    onChange={(e) => setBarberName(e.target.value)}
                    className="h-11 w-full rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-3 text-[13.5px] font-semibold text-[#111318]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C6068] mb-1">
                    Role
                  </label>
                  <select
                    value={barberRole}
                    onChange={(e) =>
                      setBarberRole(e.target.value as RestaurantStaffRole)
                    }
                    className="h-11 w-full rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-3 text-[13.5px] font-semibold text-[#111318]"
                  >
                    {BARBER_STAFF_ROLES.map((r) => (
                      <option key={r} value={r}>
                        {STAFF_ROLE_METADATA[r].label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C6068] mb-1">
                    Barber ID (Auto: {nextSuggestedCode})
                  </label>
                  <input
                    type="text"
                    maxLength={20}
                    placeholder={nextSuggestedCode}
                    value={customCode}
                    onChange={(e) => setCustomCode(e.target.value.toUpperCase())}
                    className="h-11 w-full rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-3 font-mono text-[13.5px] font-bold text-[#111318]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-[#5C6068] mb-1">
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
                      className="h-11 w-full rounded-xl border border-[#111318]/20 bg-[#FFFFFF] pl-3 pr-10 font-mono text-[14px] font-bold text-[#111318]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowAddPin((v) => !v)}
                      aria-label={showAddPin ? 'Hide PIN' : 'Show PIN'}
                      className="absolute right-2.5 text-[#5C6068] hover:text-[#111318] cursor-pointer"
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
                className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#111318] px-5 text-[13.5px] font-extrabold text-[#FAF8F5] hover:bg-[#1F232C] disabled:opacity-60 cursor-pointer"
              >
                <Plus className="h-4 w-4 text-[#F3E3B8]" aria-hidden />
                {creatingBarber ? 'Adding Barber…' : 'Add Barber to Roster'}
              </button>
            </form>

            {/* Barber Directory List */}
            <div className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-6 shadow-xs space-y-3">
              <h3 className="text-[16px] font-extrabold text-[#111318]">
                Active Barber Team ({staffMembers.length})
              </h3>
              {staffMembers.length === 0 ? (
                <p className="text-[13.5px] text-[#5C6068] py-4 text-center">
                  No barbers added yet. Add your first barber above (e.g. Arjun • BAR-01) so they can control the chair timer from their phone.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {staffMembers.map((member) => (
                    <div
                      key={member.id}
                      className="rounded-2xl border border-[#111318]/12 bg-[#FFFFFF] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <span className="inline-flex h-10 min-w-16 items-center justify-center rounded-xl bg-[#111318] px-2.5 font-mono text-[12px] font-extrabold text-[#F3E3B8]">
                          {member.staffCode}
                        </span>
                        <div className="min-w-0">
                          <p className="text-[15px] font-extrabold text-[#111318] truncate">
                            {member.fullName}
                          </p>
                          <p className="text-[12px] font-semibold text-[#5C6068]">
                            {STAFF_ROLE_METADATA[member.role]?.label ?? 'Barber'} •{' '}
                            {member.isActive ? 'Active' : 'Paused'}
                          </p>
                        </div>
                      </div>

                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={() => void handleToggleBarberActive(member)}
                          className={`h-9 rounded-xl border px-3 text-[12px] font-bold cursor-pointer ${
                            member.isActive
                              ? 'border-emerald-200 bg-emerald-50 text-[#059669]'
                              : 'border-amber-200 bg-amber-50 text-[#D97706]'
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
                          className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#111318]/15 bg-[#FAF8F5] px-3 text-[12px] font-bold text-[#111318] cursor-pointer"
                        >
                          <KeyRound className="h-3.5 w-3.5" aria-hidden />
                          Reset PIN
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleDeleteBarber(member)}
                          aria-label={`Remove ${member.fullName}`}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
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
                            className="h-9 w-36 rounded-lg border border-[#111318]/20 px-2.5 font-mono text-[13px] font-bold text-[#111318]"
                          />
                          <button
                            type="button"
                            disabled={savingPinId === member.id}
                            onClick={() => void handleSaveResetPin(member)}
                            className="h-9 rounded-lg bg-[#111318] px-3 text-[12px] font-bold text-[#F3E3B8] cursor-pointer"
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

        {/* TAB 4: GROOMING LOYALTY REWARDS & GOOGLE REVIEWS */}
        {activeTab === 'loyalty_reviews' && (
          <div className="space-y-6">
            {/* Grooming Rewards Catalogue */}
            <div className="rounded-3xl border border-[#111318]/12 bg-[#FAF8F5] p-6 shadow-xs space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h2 className="text-[20px] font-black text-[#111318] flex items-center gap-2">
                    <Award className="h-5 w-5 text-[#C89B3C]" aria-hidden />
                    Barber Loyalty Star Rewards
                  </h2>
                  <p className="text-[13px] text-[#5C6068] mt-0.5">
                    Regulars earn +1 Loyalty Star automatically whenever you complete their cut. Rewards show right on their live queue pass!
                  </p>
                </div>
              </div>

              <form
                onSubmit={(e) => void handleCreateReward(e)}
                className="grid gap-3 sm:grid-cols-12 rounded-2xl border border-[#111318]/10 bg-[#FFFFFF] p-4"
              >
                <input
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Reward title (e.g. Free Beard Trim)"
                  value={rewardTitle}
                  onChange={(e) => setRewardTitle(e.target.value)}
                  className="sm:col-span-5 h-10 rounded-xl border border-[#111318]/20 px-3 text-[13px] font-semibold text-[#111318]"
                />
                <input
                  type="text"
                  maxLength={120}
                  placeholder="Short note (optional)"
                  value={rewardDesc}
                  onChange={(e) => setRewardDesc(e.target.value)}
                  className="sm:col-span-3 h-10 rounded-xl border border-[#111318]/20 px-3 text-[13px] text-[#111318]"
                />
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={rewardStars}
                  onChange={(e) => setRewardStars(e.target.value)}
                  aria-label="Stars required"
                  className="sm:col-span-2 h-10 rounded-xl border border-[#111318]/20 px-3 text-[13px] font-bold text-[#111318]"
                />
                <button
                  type="submit"
                  disabled={creatingReward}
                  className="sm:col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-xl bg-[#111318] px-3 text-[12.5px] font-extrabold text-[#F3E3B8] hover:bg-[#1F232C] cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Add ★
                </button>
              </form>

              {rewards.length === 0 ? (
                <p className="text-[13px] text-[#5C6068] text-center py-3">
                  No rewards created yet. Add one like &ldquo;Free Beard Trim (5 ★)&rdquo; or &ldquo;Free Haircut (10 ★)&rdquo;.
                </p>
              ) : (
                <div className="grid gap-3 sm:grid-cols-2">
                  {rewards.map((reward) => (
                    <div
                      key={reward.id}
                      className="rounded-2xl border border-[#111318]/12 bg-[#FFFFFF] p-4 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <span className="inline-flex items-center gap-1 rounded-full bg-[#F3E3B8] px-2.5 py-0.5 text-[11px] font-extrabold text-[#111318]">
                          ★ {reward.starsRequired} Stars
                        </span>
                        <p className="mt-1.5 text-[15px] font-extrabold text-[#111318] truncate">
                          {reward.title}
                        </p>
                        {reward.description && (
                          <p className="text-[12px] text-[#5C6068] truncate">
                            {reward.description}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => void handleDeleteReward(reward)}
                        aria-label={`Delete ${reward.title}`}
                        className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Barber Google Review & AI Settings */}
            <div className="space-y-5">
              <GoogleUrlSettings
                key={`barber-google-${business.id}`}
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
          </div>
        )}
      </div>
    </div>
  );
}
