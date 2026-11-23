import { useEffect, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  Award,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  Dumbbell,
  ExternalLink,
  IndianRupee,
  LayoutDashboard,
  Plus,
  QrCode,
  ShoppingBag,
  Sparkles,
  Trash2,
  Users,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type { GymPlan } from '../../types/gym';
import { businessRepository } from '../../services/storage';
import { getGymPortalUrl } from '../../utils/gymValidation';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import { GymManagerView, type GymCommandSection } from './GymManagerView';
import { QRCodeManager } from '../dashboard/QRCodeManager';
import { GoogleUrlSettings } from '../dashboard/GoogleUrlSettings';
import { AIConfigurationSettings } from '../dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../dashboard/BusinessKnowledgeSettings';

export type GymStudioTab =
  | GymCommandSection
  | 'plans_qr'
  | 'reviews';

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
  onSelectBusiness,
  onBusinessUpdated,
  initialTab = 'dashboard',
}: Props) {
  const [activeTab, setActiveTab] = useState<GymStudioTab>(initialTab);

  // Plans & Static Entrance QR Settings
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
        // Non-blocking
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

  async function handleSaveGymConfig(e: FormEvent) {
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

  const navItems: ReadonlyArray<{
    id: GymStudioTab;
    label: string;
    short: string;
    Icon: typeof LayoutDashboard;
  }> = [
    { id: 'dashboard', label: 'Dashboard', short: 'Home', Icon: LayoutDashboard },
    { id: 'members', label: 'Members', short: 'Members', Icon: Users },
    { id: 'trainers', label: 'PT & Trainers', short: 'Trainers', Icon: Award },
    { id: 'dues', label: 'Payments & Dues', short: 'Dues', Icon: IndianRupee },
    { id: 'supplements', label: 'Supplement Bar', short: 'Bar POS', Icon: ShoppingBag },
    { id: 'workouts', label: 'Workout Plans', short: 'Plans', Icon: ClipboardList },
    { id: 'plans_qr', label: 'Plans & Static QR', short: 'QR', Icon: QrCode },
    { id: 'reviews', label: 'AI Reviews', short: 'Reviews', Icon: Sparkles },
  ];

  const isCommandSection =
    activeTab !== 'plans_qr' && activeTab !== 'reviews';

  return (
    <div className="flex min-h-[calc(100vh-52px)] w-full flex-col lg:flex-row">
      {/* DARK OBSIDIAN LEFT SIDEBAR (#0F1115) WITH VOLT LIME ACTIVE PILLS (#C8F135) */}
      <aside
        aria-label="GymOS Command Sidebar"
        className="w-full lg:w-[248px] lg:shrink-0 bg-[#0F1115] text-white flex flex-col justify-between lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:overflow-y-auto border-b lg:border-b-0 lg:border-r border-white/10"
      >
        <div className="p-4 space-y-4">
          {/* Brand + Gym Switcher (Clux Gym Style Emblem) */}
          <div className="space-y-2.5 border-b border-white/10 pb-4">
            <div className="flex items-center justify-between px-1">
              <span className="inline-flex items-center gap-2 text-[12px] font-black tracking-tight text-white">
                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-[#C8F135] text-[#0F1115] shadow-[0_0_12px_rgba(200,241,53,0.4)]">
                  <Dumbbell className="h-3.5 w-3.5" aria-hidden />
                </span>
                GymOS Studio
              </span>
              <Link
                to="/setup?type=gym"
                className="gym-tactile inline-flex items-center gap-1 rounded-lg border border-white/10 bg-[#161920] px-2 py-0.5 text-[11px] font-bold text-slate-300 hover:border-[#C8F135]/40 hover:text-[#C8F135]"
              >
                <Plus className="h-3 w-3" aria-hidden /> New
              </Link>
            </div>
            <div className="flex h-10 items-center gap-2 rounded-xl border border-white/10 bg-[#161920] px-2.5 transition-colors focus-within:border-[#C8F135]">
              <Building2 className="h-4 w-4 shrink-0 text-[#C8F135]" aria-hidden />
              <select
                aria-label="Select active gym"
                value={business.slug}
                onChange={(e) => onSelectBusiness(e.target.value)}
                className="w-full min-w-0 truncate bg-transparent text-[13px] font-bold text-white focus:outline-none cursor-pointer"
              >
                {gymBusinesses.map((b) => (
                  <option key={b.id} value={b.slug} className="bg-[#0F1115] text-white">
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Sidebar Nav Buttons */}
          <nav className="flex overflow-x-auto lg:overflow-x-visible lg:flex-col gap-1">
            {navItems.map(({ id, label, short, Icon }) => {
              const active = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className={`gym-tactile flex h-10 shrink-0 lg:shrink lg:w-full items-center gap-2.5 rounded-xl px-3 text-[13px] font-bold transition-all cursor-pointer ${
                    active
                      ? 'bg-[#C8F135] text-[#0F1115] shadow-sm font-extrabold'
                      : 'text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <Icon
                    className={`h-4 w-4 shrink-0 ${
                      active ? 'text-[#0F1115]' : 'text-slate-400'
                    }`}
                    aria-hidden
                  />
                  <span className="hidden sm:inline truncate">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </button>
              );
            })}
          </nav>
        </div>

        {/* Bottom Static Entrance QR Quick-Launch Card */}
        <div className="hidden lg:block border-t border-white/10 p-3.5 space-y-3">
          <div className="rounded-2xl bg-[#161920] border border-white/10 p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#C8F135]">
                Static Entrance QR
              </span>
              <span
                className={`gym-pulse-dot h-2 w-2 rounded-full ${isBusinessLive ? 'bg-[#C8F135] text-[#C8F135]' : 'bg-amber-400 text-amber-400'}`}
              />
            </div>
            <p className="text-[11.5px] text-slate-400 leading-snug">
              ₹0 reception hardware — 1 printed entrance poster powers member passes,
              check-ins &amp; workout logging.
            </p>
            {isBusinessLive && (
              <a
                href={gymPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="gym-tactile flex h-8.5 w-full items-center justify-center gap-1.5 rounded-xl bg-[#C8F135] text-[12px] font-extrabold text-[#0F1115] hover:bg-[#b8e028]"
              >
                Open Member App <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>
      </aside>

      {/* CRISP LIGHT MILK WORKSPACE (#F8F9FA) CENTERED */}
      <div className="flex-1 min-w-0 bg-[#F8F9FA] px-4 py-4 sm:px-6 sm:py-6">
        <div className="mx-auto max-w-7xl w-full space-y-5">
        {!isBusinessLive && (
          <div
            role="status"
            className="gym-fade-up rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 flex items-center gap-2 text-[13px] font-semibold text-amber-950 shadow-sm"
          >
            <Clock className="h-4 w-4 text-amber-700 shrink-0" aria-hidden />
            Preview Mode — Awaiting Platform Admin Approval. You can set up
            plans, trainers, workout routines &amp; supplement products right now.
          </div>
        )}

        {/* COMMAND SECTIONS (Dashboard, Members, PT & Trainers, Dues, Supplement Bar, Workout Plans) */}
        {isCommandSection && (
          <GymManagerView
            business={business}
            isBusinessLive={isBusinessLive}
            activeSection={activeTab as GymCommandSection}
            onSectionChange={(sec) => setActiveTab(sec)}
            onOpenEntranceQr={() => setActiveTab('plans_qr')}
          />
        )}

        {/* PLANS & SINGLE STATIC PRINTED ENTRANCE QR */}
        {activeTab === 'plans_qr' && (
          <div className="space-y-6">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-[22px] font-extrabold text-[#0F1115]">
                Membership Plans &amp; Single Static Entrance QR
              </h1>
              <p className="text-[13px] text-slate-500">
                Print ONE high-contrast entrance poster for reception — zero
                tablet required — and configure your plans &amp; 3-day alert
                window.
              </p>
            </div>

            {statusMsg && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-semibold text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" aria-hidden />
                {statusMsg}
              </div>
            )}
            {errorMsg && (
              <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-[13px] font-semibold text-rose-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4" aria-hidden />
                {errorMsg}
              </div>
            )}

            <form
              onSubmit={(e) => void handleSaveGymConfig(e)}
              className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="inline-flex items-center gap-2 text-[13.5px] font-bold text-[#0F1115] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isRegistrationOpen}
                    onChange={(e) => setIsRegistrationOpen(e.target.checked)}
                    className="h-4 w-4 accent-[#0F1115]"
                  />
                  Accept New Member QR Signups
                </label>

                <div className="flex items-center gap-2">
                  <label className="text-[12.5px] font-bold text-slate-600">
                    Renewal Alert Window:
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={renewalAlertDays}
                    onChange={(e) =>
                      setRenewalAlertDays(Number.parseInt(e.target.value, 10) || 3)
                    }
                    className="h-9 w-16 rounded-lg border border-slate-300 px-2 text-center text-[13px] font-extrabold"
                  />
                  <span className="text-[12px] text-slate-500">days</span>
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-2">
                {plansDraft.map((plan) => (
                  <div
                    key={plan.id}
                    className="flex items-center justify-between rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-[13.5px] font-extrabold text-[#0F1115]">
                        {plan.name}
                      </p>
                      <p className="text-[12px] text-slate-500">
                        {plan.durationDays} days ·{' '}
                        <strong>
                          {formatPriceFromPaise(plan.pricePaise, 'INR')}
                        </strong>
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        setPlansDraft((prev) =>
                          prev.filter((p) => p.id !== plan.id),
                        )
                      }
                      className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                ))}
              </div>

              <div className="grid gap-2 sm:grid-cols-4 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  placeholder="New Plan Name"
                  value={newPlanName}
                  onChange={(e) => setNewPlanName(e.target.value)}
                  className="h-9.5 rounded-xl border border-slate-300 px-3 text-[13px]"
                />
                <input
                  type="number"
                  placeholder="Days (e.g. 90)"
                  value={newPlanDays}
                  onChange={(e) => setNewPlanDays(e.target.value)}
                  className="h-9.5 rounded-xl border border-slate-300 px-3 text-[13px]"
                />
                <input
                  type="number"
                  placeholder="Fee ₹ (e.g. 4000)"
                  value={newPlanRupees}
                  onChange={(e) => setNewPlanRupees(e.target.value)}
                  className="h-9.5 rounded-xl border border-slate-300 px-3 text-[13px]"
                />
                <button
                  type="button"
                  onClick={handleAddPlan}
                  className="h-9.5 rounded-xl border border-[#0F1115] text-[12.5px] font-extrabold text-[#0F1115] hover:bg-slate-100 cursor-pointer"
                >
                  + Add Plan
                </button>
              </div>

              <div className="flex justify-end">
                <button
                  type="submit"
                  disabled={savingConfig}
                  className="h-10 rounded-xl bg-[#0F1115] px-5 text-[13px] font-extrabold text-[#C8F135] cursor-pointer"
                >
                  {savingConfig ? 'Saving…' : 'Save Plans & Settings ✓'}
                </button>
              </div>
            </form>

            {isBusinessLive && (
              <QRCodeManager business={business} defaultMode="gym" />
            )}
          </div>
        )}

        {/* AI REVIEWS & GOOGLE REPUTATION */}
        {activeTab === 'reviews' && (
          <div className="space-y-5">
            <div className="border-b border-slate-200 pb-4">
              <h1 className="text-[22px] font-extrabold text-[#0F1115]">
                Gym AI Google Reviews &amp; Reputation
              </h1>
              <p className="text-[13px] text-slate-500">
                Configure your Google Review link, AI reply voice, and Gym
                Knowledge context.
              </p>
            </div>
            <AIConfigurationSettings business={business} />
            <BusinessKnowledgeSettings business={business} />
            <GoogleUrlSettings
              business={business}
              onUpdated={onBusinessUpdated}
            />
          </div>
        )}
        </div>
      </div>
    </div>
  );
}
