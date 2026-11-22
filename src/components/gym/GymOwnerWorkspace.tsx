import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Dumbbell,
  QrCode,
  Settings,
  Sparkles,
  Plus,
  ExternalLink,
  Clock,
  CheckCircle2,
  ShieldAlert,
  Ban,
  AlertCircle,
  Trash2,
  Building2,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type { GymPlan } from '../../types/gym';
import { businessRepository } from '../../services/storage';
import { categoryLabels } from '../../config/reviewExperience';
import { getGymPortalUrl } from '../../utils/gymValidation';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import { GymManagerView } from './GymManagerView';
import { QRCodeManager } from '../dashboard/QRCodeManager';
import { GoogleUrlSettings } from '../dashboard/GoogleUrlSettings';
import { AIConfigurationSettings } from '../dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../dashboard/BusinessKnowledgeSettings';

export type GymStudioTab = 'radar' | 'front_desk_qr' | 'plans' | 'reviews';

interface Props {
  business: Business;
  gymBusinesses: Business[];
  hasOtherBusinesses?: boolean;
  onSelectBusiness: (slug: string) => void;
  onBusinessUpdated: (updated: Business) => void;
  initialTab?: GymStudioTab;
}

export function GymOwnerWorkspace({
  business,
  gymBusinesses,
  hasOtherBusinesses = false,
  onSelectBusiness,
  onBusinessUpdated,
  initialTab = 'radar',
}: Props) {
  const [activeTab, setActiveTab] = useState<GymStudioTab>(initialTab);

  // Plans & Expiry Alert Settings
  const [isRegistrationOpen, setIsRegistrationOpen] = useState(true);
  const [renewalAlertDays, setRenewalAlertDays] = useState(3);
  const [plansDraft, setPlansDraft] = useState<GymPlan[]>([]);
  const [newPlanName, setNewPlanName] = useState('');
  const [newPlanDays, setNewPlanDays] = useState('30');
  const [newPlanRupees, setNewPlanRupees] = useState('1500');
  const [savingConfig, setSavingConfig] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const currentStatus = business.status ?? 'pending';
  const currentAccountState = business.accountState ?? 'active';
  const isBusinessLive =
    currentStatus === 'active' && currentAccountState === 'active';
  const gymPortalUrl = getGymPortalUrl(business.slug);

  useEffect(() => {
    let cancelled = false;
    async function loadCfg() {
      try {
        const cfg = await businessRepository.getGymConfig(business.id);
        if (!cancelled) {
          setIsRegistrationOpen(cfg.isRegistrationOpen);
          setRenewalAlertDays(cfg.renewalAlertDays);
          setPlansDraft(cfg.plans);
        }
      } catch {
        // non-blocking
      }
    }
    void loadCfg();
    return () => {
      cancelled = true;
    };
  }, [business.id]);

  function handleAddPlan() {
    const cleanName = newPlanName.trim();
    const days = Number.parseInt(newPlanDays, 10);
    const rupees = Number.parseFloat(newPlanRupees);
    if (!cleanName || !Number.isInteger(days) || days < 1 || days > 1095) {
      setErrorMsg('Enter a plan name and valid duration (1–1095 days).');
      return;
    }
    if (!Number.isFinite(rupees) || rupees < 0) {
      setErrorMsg('Enter a valid fee in ₹.');
      return;
    }
    setErrorMsg(null);
    const id = cleanName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .slice(0, 24);
    setPlansDraft((prev) => [
      ...prev,
      {
        id: `${id}_${prev.length + 1}`,
        name: cleanName,
        durationDays: days,
        pricePaise: Math.round(rupees * 100),
      },
    ]);
    setNewPlanName('');
  }

  async function handleSaveGymConfig(e: React.FormEvent) {
    e.preventDefault();
    setSavingConfig(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const updated = await businessRepository.updateGymConfig(business.id, {
        isRegistrationOpen,
        renewalAlertDays,
        plans: plansDraft,
      });
      setIsRegistrationOpen(updated.isRegistrationOpen);
      setRenewalAlertDays(updated.renewalAlertDays);
      setPlansDraft(updated.plans);
      setStatusMsg('Saved GymOS plans and renewal alert settings!');
      window.setTimeout(() => setStatusMsg(null), 4000);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  const statusPillConfig: Record<
    NonNullable<Business['status']>,
    { label: string; className: string; Icon: typeof CheckCircle2 }
  > = {
    pending: {
      label: 'Awaiting Gym Admin Approval',
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
      className: 'bg-white/10 text-slate-300 border-white/20',
      Icon: ShieldAlert,
    },
  };

  const currentPill = statusPillConfig[currentStatus];
  const StatusIcon = currentPill.Icon;

  const navItems: {
    id: GymStudioTab;
    label: string;
    shortLabel: string;
    Icon: typeof Dumbbell;
  }[] = [
    {
      id: 'radar',
      label: 'Renewal Radar & Approvals',
      shortLabel: 'Radar',
      Icon: Dumbbell,
    },
    {
      id: 'front_desk_qr',
      label: 'Front-Desk Gym QR',
      shortLabel: 'Gym QR',
      Icon: QrCode,
    },
    {
      id: 'plans',
      label: 'Plans & Alert Rules',
      shortLabel: 'Plans',
      Icon: Settings,
    },
    {
      id: 'reviews',
      label: 'Google Reviews & AI',
      shortLabel: 'Reviews',
      Icon: Sparkles,
    },
  ];

  return (
    <div className="grid gap-6 lg:grid-cols-12 items-start animate-fadeSlideUp">
      {/* SEPARATE GYMOS STUDIO SIDEBAR (Deep Slate #0F172A + Volt Lime #A3E635) */}
      <aside
        aria-label="GymOS Workspace Navigation"
        className="lg:col-span-3 overflow-hidden rounded-3xl border border-slate-800 bg-[#0F172A] text-white shadow-lg flex flex-col justify-between lg:min-h-[640px]"
      >
        <div>
          <div className="h-1.5 w-full bg-gradient-to-r from-[#A3E635] via-[#BEF264] to-[#22C55E]" />

          <div className="p-5 space-y-5">
            <div className="flex items-center justify-between gap-2 border-b border-white/10 pb-4">
              <div className="flex items-center gap-2.5 min-w-0">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#A3E635] text-[#0F172A]">
                  <Dumbbell className="h-5 w-5" aria-hidden />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#A3E635]">
                    GYMOS STUDIO
                  </p>
                  <p className="truncate text-[14px] font-black text-white">
                    Membership &amp; Expiry
                  </p>
                </div>
              </div>
              <Link
                to="/setup?type=gym"
                className="inline-flex items-center gap-1 rounded-lg border border-white/15 bg-white/5 px-2.5 py-1 text-[11px] font-bold text-[#A3E635] hover:bg-white/10"
              >
                <Plus className="h-3 w-3" aria-hidden /> New
              </Link>
            </div>

            <div className="space-y-1.5">
              <span className="block text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Active Gym / Fitness Studio
              </span>
              <div className="flex h-11 items-center gap-2 rounded-xl border border-white/15 bg-slate-900 px-3">
                <Building2
                  className="h-4 w-4 shrink-0 text-[#A3E635]"
                  aria-hidden
                />
                <select
                  aria-label="Select active gym"
                  value={business.slug}
                  onChange={(e) => onSelectBusiness(e.target.value)}
                  className="w-full min-w-0 truncate bg-transparent text-[13.5px] font-bold text-white focus:outline-none cursor-pointer"
                >
                  {gymBusinesses.map((b) => (
                    <option
                      key={b.id}
                      value={b.slug}
                      className="bg-[#0F172A] text-white"
                    >
                      {b.name} ({b.city})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <nav className="flex overflow-x-auto lg:flex-col gap-1.5">
              {navItems.map(({ id, label, shortLabel, Icon }) => {
                const isActive = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setActiveTab(id)}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-4 py-2.5 text-[13.5px] font-extrabold whitespace-nowrap transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                      isActive
                        ? 'bg-[#A3E635] text-[#0F172A] shadow-sm'
                        : 'text-slate-300 hover:bg-white/5 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${
                        isActive ? 'text-[#0F172A]' : 'text-[#A3E635]'
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

        <div className="border-t border-white/10 p-5 space-y-3 bg-slate-950/60">
          <div className="space-y-1">
            <p className="truncate text-[14px] font-extrabold text-white">
              {business.name}
            </p>
            <p className="truncate text-[12px] text-slate-400">
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
            <a
              href={gymPortalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#A3E635]/40 bg-slate-900 px-3 text-[12px] font-extrabold text-[#A3E635] hover:bg-[#A3E635] hover:text-[#0F172A] transition-colors"
            >
              Open Member QR Portal <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}

          {hasOtherBusinesses && (
            <div className="pt-2 border-t border-white/10">
              <Link
                to="/dashboard?view=all"
                className="inline-flex items-center gap-1.5 text-[11.5px] font-semibold text-slate-400 hover:text-[#A3E635]"
              >
                Switch Business Workspace →
              </Link>
            </div>
          )}
        </div>
      </aside>

      {/* MAIN GYMOS CONTENT */}
      <div className="lg:col-span-9 min-w-0 space-y-5">
        {!isBusinessLive && (
          <div
            role="status"
            className="rounded-3xl border border-amber-300 bg-amber-50 p-5 space-y-1.5"
          >
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4.5 w-4.5 text-amber-700" aria-hidden />
              <h2 className="text-[15px] font-extrabold text-slate-900">
                {currentStatus === 'pending'
                  ? 'Gym Workspace in Preview Mode — Awaiting Admin Approval'
                  : 'Public Gym Check-In Portal Offline'}
              </h2>
            </div>
            <p className="text-[13px] text-slate-600">
              Configure your membership plans and renewal alerts below. Once
              approved under <strong>Gyms &amp; Fitness</strong> in{' '}
              <Link to="/admin" className="font-bold text-slate-900 underline">
                Admin Panel
              </Link>
              , your Front-Desk Member QR unlocks immediately.
            </p>
          </div>
        )}

        {activeTab === 'radar' && (
          <GymManagerView
            key={`gym-radar-${business.id}`}
            business={business}
            isBusinessLive={isBusinessLive}
          />
        )}

        {activeTab === 'front_desk_qr' && (
          <div className="space-y-5">
            <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#0F172A] px-3 py-1 text-[10.5px] font-extrabold uppercase tracking-wider text-[#A3E635]">
                <QrCode className="h-3.5 w-3.5" aria-hidden />
                Replace Dusty Paper Registers
              </span>
              <h1 className="text-[24px] font-black tracking-tight text-slate-900">
                Front-Desk Gym Membership &amp; Check-In QR Standee
              </h1>
              <p className="text-[13.5px] text-slate-600 leading-relaxed">
                Print and place this QR at your reception desk. New members scan
                to sign up in 10 seconds; returning members scan to see their{' '}
                <strong>Days Remaining</strong> and tap{' '}
                <strong>Daily Check-In ✓</strong>.
              </p>
            </div>

            {isBusinessLive ? (
              <QRCodeManager
                key={`gym-qr-${business.id}`}
                business={business}
                defaultMode="gym"
              />
            ) : (
              <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center space-y-3">
                <Clock className="mx-auto h-8 w-8 text-amber-500" aria-hidden />
                <h3 className="text-[18px] font-extrabold text-slate-900">
                  Front-Desk Gym QR Unlocks After Approval
                </h3>
                <p className="mx-auto max-w-md text-[13.5px] text-slate-600">
                  Approve <strong>{business.name}</strong> in Admin Panel →{' '}
                  <strong>Gyms &amp; Fitness</strong> to export your printable PNG &amp; A5 PDF standee.
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'plans' && (
          <form
            onSubmit={(e) => void handleSaveGymConfig(e)}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6"
          >
            <div>
              <h1 className="text-[24px] font-black text-slate-900">
                Membership Plans &amp; Expiry Alert Rules
              </h1>
              <p className="text-[13px] text-slate-500 mt-0.5">
                Customize your gym plans, durations, and how many days before expiry GymOS triggers urgent red alerts.
              </p>
            </div>

            {statusMsg && (
              <div
                role="status"
                className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-800"
              >
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                <span>{statusMsg}</span>
              </div>
            )}
            {errorMsg && (
              <div
                role="alert"
                className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
              >
                <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 cursor-pointer">
                <div>
                  <p className="text-[14px] font-extrabold text-slate-900">
                    Accept New QR Registrations
                  </p>
                  <p className="text-[12px] text-slate-500">
                    Allow walk-ins to submit signup cards via Front-Desk QR
                  </p>
                </div>
                <input
                  type="checkbox"
                  checked={isRegistrationOpen}
                  onChange={(e) => setIsRegistrationOpen(e.target.checked)}
                  className="h-5 w-5 accent-slate-900"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-1.5">
                <label
                  htmlFor="renewalAlertDaysInput"
                  className="block text-[13px] font-extrabold text-slate-900"
                >
                  Urgent Renewal Alert Window (Days Before Expiry)
                </label>
                <input
                  id="renewalAlertDaysInput"
                  type="number"
                  min={1}
                  max={30}
                  value={renewalAlertDays}
                  onChange={(e) =>
                    setRenewalAlertDays(
                      Math.max(1, Math.min(30, Number(e.target.value) || 3)),
                    )
                  }
                  className="h-10 w-28 rounded-xl border border-slate-300 bg-white px-3 text-[14px] font-black text-slate-900"
                />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-[12px] font-extrabold uppercase tracking-wider text-slate-500">
                Active Membership Plans ({plansDraft.length})
              </p>
              <div className="space-y-2">
                {plansDraft.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <div>
                      <p className="text-[14px] font-extrabold text-slate-900">
                        {plan.name}
                      </p>
                      <p className="text-[12px] font-semibold text-slate-500">
                        {plan.durationDays} days •{' '}
                        {formatPriceFromPaise(plan.pricePaise, 'INR')}
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={plansDraft.length <= 1}
                      onClick={() =>
                        setPlansDraft((prev) =>
                          prev.filter((p) => p.id !== plan.id),
                        )
                      }
                      aria-label={`Remove ${plan.name}`}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 disabled:opacity-40 cursor-pointer"
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid gap-2.5 sm:grid-cols-12 rounded-2xl border border-dashed border-slate-300 p-3.5">
                <input
                  type="text"
                  placeholder="Plan name (e.g. 2 Months Summer)"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="sm:col-span-5 h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-semibold text-slate-900"
                />
                <input
                  type="number"
                  min={1}
                  max={1095}
                  placeholder="Days"
                  value={newPlanDays}
                  onChange={(e) => setNewPlanDays(e.target.value)}
                  className="sm:col-span-2 h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-900"
                />
                <input
                  type="number"
                  min={0}
                  placeholder="Fee (₹)"
                  value={newPlanRupees}
                  onChange={(e) => setNewPlanRupees(e.target.value)}
                  className="sm:col-span-3 h-10 rounded-xl border border-slate-300 bg-white px-3 text-[13px] font-bold text-slate-900"
                />
                <button
                  type="button"
                  onClick={handleAddPlan}
                  className="sm:col-span-2 h-10 rounded-xl bg-slate-900 px-3 text-[12.5px] font-extrabold text-[#A3E635] hover:bg-slate-800 cursor-pointer"
                >
                  + Add
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={savingConfig}
              className="inline-flex h-11 items-center justify-center rounded-xl bg-[#0F172A] px-6 text-[14px] font-black text-[#A3E635] hover:bg-slate-800 disabled:opacity-60 cursor-pointer"
            >
              {savingConfig ? 'Saving…' : 'Save Plans & Expiry Rules'}
            </button>
          </form>
        )}

        {activeTab === 'reviews' && (
          <div className="space-y-5">
            <GoogleUrlSettings
              key={`gym-google-${business.id}`}
              business={business}
              onUpdated={onBusinessUpdated}
            />
            <AIConfigurationSettings
              key={`gym-ai-${business.id}`}
              business={business}
            />
            <BusinessKnowledgeSettings
              key={`gym-knowledge-${business.id}`}
              business={business}
            />
          </div>
        )}
      </div>
    </div>
  );
}
