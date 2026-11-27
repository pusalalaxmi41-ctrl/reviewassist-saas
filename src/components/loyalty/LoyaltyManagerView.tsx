import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Building2,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gift,
  KeyRound,
  LayoutDashboard,
  Plus,
  QrCode,
  RefreshCw,
  Search,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
  X,
  XCircle,
} from 'lucide-react';
import type {
  AnalyticsEvent,
  Business,
  BusinessMetrics,
  CustomerDraftRecord,
} from '../../types/business';
import type {
  LoyaltyMemberCard,
  LoyaltyOwnerDashboardPayload,
  LoyaltyVerificationMode,
} from '../../types/loyalty';
import { businessRepository } from '../../services/storage';
import { categoryLabels } from '../../config/reviewExperience';
import { getLoyaltyPortalUrl } from '../../utils/loyaltyValidation';
import { loadBusinessQRSettings } from '../../services/qr/qrGenerator';
import { QRCodeManager } from '../dashboard/QRCodeManager';
import { CustomerDraftsView } from '../dashboard/CustomerDraftsView';
import { AnalyticsView } from '../dashboard/AnalyticsView';
import { GoogleUrlSettings } from '../dashboard/GoogleUrlSettings';
import { BusinessCategorySettings } from '../dashboard/BusinessCategorySettings';
import { AIConfigurationSettings } from '../dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../dashboard/BusinessKnowledgeSettings';

type LoyaltyTab = 'overview' | 'members' | 'rewards' | 'settings' | 'ai_reviews';

interface Props {
  business: Business;
  loyaltyBusinesses: Business[];
  hasOtherBusinesses?: boolean;
  embedded?: boolean;
  onSelectBusiness: (slug: string) => void;
  onBusinessUpdated: (updated: Business) => void;
}

const ACCENT_PRESETS = [
  { hex: '#C8F135', label: 'Volt Lime' },
  { hex: '#D5A63C', label: 'Brushed Gold' },
  { hex: '#22C55E', label: 'Emerald Mint' },
  { hex: '#38BDF8', label: 'Electric Sky' },
];

export function LoyaltyManagerView({
  business,
  loyaltyBusinesses,
  hasOtherBusinesses = false,
  embedded = false,
  onSelectBusiness,
  onBusinessUpdated,
}: Props) {
  const [activeTab, setActiveTab] = useState<LoyaltyTab>('overview');
  const [aiSubTab, setAiSubTab] = useState<'qr' | 'drafts' | 'analytics' | 'config'>('qr');

  const [dashboard, setDashboard] =
    useState<LoyaltyOwnerDashboardPayload | null>(null);
  const [loading, setLoading] = useState(true);

  // Shared AI Reviews data (reuse existing funnel & drafts)
  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  // Feedback banners
  const [toast, setToast] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Members Directory + Detail + Desk Star Issuer
  const [memberSearch, setMemberSearch] = useState('');
  const [selectedMemberId, setSelectedMemberId] = useState<string | null>(null);
  const [deskName, setDeskName] = useState('');
  const [deskPhone, setDeskPhone] = useState('');
  const [deskNote, setDeskNote] = useState('');
  const [issuingDeskStar, setIssuingDeskStar] = useState(false);

  // Program Settings State
  const [starsRequired, setStarsRequired] = useState(5);
  const [rewardTitle, setRewardTitle] = useState('Flat 20% OFF or Free Signature Item');
  const [rewardDesc, setRewardDesc] = useState('');
  const [verificationMode, setVerificationMode] =
    useState<LoyaltyVerificationMode>('cooldown_only');
  const [counterPin, setCounterPin] = useState('1234');
  const [cooldownHours, setCooldownHours] = useState(12);
  const [brandAccentHex, setBrandAccentHex] = useState('#C8F135');
  const [savingSettings, setSavingSettings] = useState(false);

  // Action busy flags & stable mount time
  const [busyCardId, setBusyCardId] = useState<string | null>(null);
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [mountNowMs, setMountNowMs] = useState<number>(() => Date.now());

  const uploadedLogo = useMemo(
    () => loadBusinessQRSettings(business).logoDataUrl,
    [business],
  );
  const portalUrl = getLoyaltyPortalUrl(business.slug);

  const loadData = useCallback(
    async (syncForm = false) => {
      try {
        const [dash, m, evts, drfts] = await Promise.all([
          businessRepository.getLoyaltyOwnerDashboard(business.id),
          businessRepository.getMetrics(business.id),
          businessRepository.getEvents(business.id),
          businessRepository.getDrafts(business.id),
        ]);
        setDashboard(dash);
        setMetrics(m);
        setEvents(evts);
        setDrafts(drfts);
        setMountNowMs(Date.now());
        if (syncForm) {
          setStarsRequired(dash.config.starsRequired);
          setRewardTitle(dash.config.rewardTitle);
          setRewardDesc(dash.config.rewardDescription ?? '');
          setVerificationMode(dash.config.verificationMode);
          setCounterPin(dash.config.counterSecretPin ?? '1234');
          setCooldownHours(dash.config.scanCooldownHours);
          setBrandAccentHex(dash.config.brandAccentHex || '#C8F135');
        }
      } catch (err) {
        setErrorMsg((err as Error).message || 'Unable to load LoyaltyOS dashboard.');
      } finally {
        setLoading(false);
      }
    },
    [business.id],
  );

  useEffect(() => {
    const t = window.setTimeout(() => void loadData(true), 0);
    return () => window.clearTimeout(t);
  }, [loadData]);

  function notify(msg: string) {
    setErrorMsg(null);
    setToast(msg);
    window.setTimeout(() => setToast(null), 4000);
  }

  async function handleConfirmRedemption(card: LoyaltyMemberCard) {
    setBusyCardId(card.id);
    setErrorMsg(null);
    try {
      await businessRepository.confirmLoyaltyRewardRedemption({
        businessId: business.id,
        cardId: card.id,
      });
      await loadData(false);
      notify(`Verified & redeemed reward for ${card.customerName} (${card.memberCode}).`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyCardId(null);
    }
  }

  async function handleApprovalDecision(
    eventId: string,
    decision: 'approved' | 'rejected',
  ) {
    setBusyEventId(eventId);
    setErrorMsg(null);
    try {
      await businessRepository.approvePendingLoyaltyStar({
        businessId: business.id,
        eventId,
        decision,
      });
      await loadData(false);
      notify(
        decision === 'approved'
          ? 'Approved visit star & updated member wallet.'
          : 'Rejected pending star request.',
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusyEventId(null);
    }
  }

  async function handleIssueDeskStar(e?: FormEvent, presetCard?: LoyaltyMemberCard) {
    if (e) e.preventDefault();
    setErrorMsg(null);
    setIssuingDeskStar(true);
    try {
      const targetName = presetCard ? presetCard.customerName : deskName;
      const targetPhone = presetCard ? presetCard.phone : deskPhone;
      const updatedCard = await businessRepository.issueLoyaltyDeskStar({
        businessId: business.id,
        customerName: targetName,
        phone: targetPhone,
        note: presetCard ? 'Desk star (+1)' : deskNote || 'Desk walk-in star',
      });
      if (!presetCard) {
        setDeskName('');
        setDeskPhone('');
        setDeskNote('');
      }
      await loadData(false);
      notify(
        `Credited +1 ★ to ${updatedCard.customerName} (${updatedCard.memberCode} — now ${updatedCard.currentStars}/${starsRequired} ★).`,
      );
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setIssuingDeskStar(false);
    }
  }

  async function handleSaveSettings(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    setSavingSettings(true);
    try {
      await businessRepository.updateLoyaltyProgramConfig(business.id, {
        starsRequired,
        rewardTitle,
        rewardDescription: rewardDesc || null,
        verificationMode,
        counterSecretPin: counterPin,
        scanCooldownHours: cooldownHours,
        googleReviewBonusEnabled: dashboard?.config.googleReviewBonusEnabled ?? true,
        googleReviewBonusStars: dashboard?.config.googleReviewBonusStars ?? 1,
        brandAccentHex,
      });
      await loadData(true);
      notify('Saved LoyaltyOS program & anti-fraud rules.');
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setSavingSettings(false);
    }
  }

  const members = useMemo(
    () => dashboard?.memberDirectory ?? [],
    [dashboard?.memberDirectory],
  );
  const pendingApprovals = useMemo(
    () => dashboard?.pendingApprovals ?? [],
    [dashboard?.pendingApprovals],
  );
  const pendingRedemptions = useMemo(
    () =>
      members.filter(
        (m) => Boolean(m.pendingRedemptionCode) || m.rewardsUnlocked > 0,
      ),
    [members],
  );
  const activeRedemptionRequests = members.filter((m) =>
    Boolean(m.pendingRedemptionCode),
  );

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase();
    if (!q) return members;
    return members.filter(
      (m) =>
        m.customerName.toLowerCase().includes(q) ||
        m.phone.toLowerCase().includes(q) ||
        m.memberCode.toLowerCase().includes(q),
    );
  }, [members, memberSearch]);

  const selectedMember = useMemo(
    () => members.find((m) => m.id === selectedMemberId) ?? null,
    [members, selectedMemberId],
  );

  const recentFeed = useMemo(
    () => dashboard?.recentActivityFeed ?? [],
    [dashboard?.recentActivityFeed],
  );

  // Compact 7-day star trend computed cleanly from real activity feed
  const chartDays = useMemo(() => {
    const buckets: Array<{ label: string; stars: number }> = [];
    for (let i = 6; i >= 0; i -= 1) {
      const dt = new Date(mountNowMs);
      dt.setHours(0, 0, 0, 0);
      dt.setDate(dt.getDate() - i);
      const dayIso = dt.toISOString().slice(0, 10);
      const stars = recentFeed
        .filter(
          (ev) =>
            ev.status === 'approved' &&
            ev.starsDelta > 0 &&
            ev.createdAt.slice(0, 10) === dayIso,
        )
        .reduce((acc, ev) => acc + ev.starsDelta, 0);
      buckets.push({
        label: dt.toLocaleDateString(undefined, { weekday: 'short' }),
        stars,
      });
    }
    return buckets;
  }, [recentFeed, mountNowMs]);

  const maxDayStars = Math.max(1, ...chartDays.map((d) => d.stars));

  const navItems: Array<{
    id: LoyaltyTab;
    label: string;
    shortLabel: string;
    Icon: typeof LayoutDashboard;
    badge?: number;
  }> = [
    {
      id: 'overview',
      label: 'Overview',
      shortLabel: 'Overview',
      Icon: LayoutDashboard,
      badge:
        activeRedemptionRequests.length + pendingApprovals.length || undefined,
    },
    {
      id: 'members',
      label: `Members (${members.length})`,
      shortLabel: 'Members',
      Icon: Users,
    },
    {
      id: 'rewards',
      label: 'Rewards & Rules',
      shortLabel: 'Rewards',
      Icon: Gift,
    },
    {
      id: 'settings',
      label: 'Anti-Fraud & PIN',
      shortLabel: 'Security',
      Icon: ShieldCheck,
    },
    {
      id: 'ai_reviews',
      label: 'Counter QR & Reviews',
      shortLabel: 'QR & AI',
      Icon: QrCode,
    },
  ];

  const isLive =
    (business.status ?? 'active') === 'active' &&
    (business.accountState ?? 'active') === 'active';

  return (
    <div
      className={
        embedded
          ? 'w-full space-y-5'
          : 'mx-auto max-w-7xl px-3 sm:px-6 py-4 sm:py-6 pb-24 lg:pb-8'
      }
    >
      {embedded && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[#2D323B] bg-[#0F1115] px-4 py-3 text-[#F8F9FA]">
          <div className="flex flex-wrap items-center gap-1.5" role="tablist">
            {navItems
              .filter((item) => item.id !== 'ai_reviews')
              .map(({ id, label, Icon, badge }) => {
                const active = activeTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveTab(id)}
                    className={`inline-flex h-9 items-center gap-2 rounded-xl px-3.5 text-xs font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'bg-[#C8F135] text-[#0F1115]'
                        : 'text-[#A0A6B1] hover:bg-[#171A20] hover:text-[#F8F9FA]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span>{label}</span>
                    {badge !== undefined && badge > 0 && (
                      <span
                        className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                          active
                            ? 'bg-[#0F1115] text-[#C8F135]'
                            : 'bg-[#F59E0B] text-[#0F1115]'
                        }`}
                      >
                        {badge}
                      </span>
                    )}
                  </button>
                );
              })}
          </div>
          <a
            href={portalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#2D323B] bg-[#171A20] px-3.5 text-xs font-semibold text-[#C8F135] hover:border-[#C8F135]"
          >
            Customer Star Wallet <ExternalLink className="h-3.5 w-3.5" aria-hidden />
          </a>
        </div>
      )}

      <div className={embedded ? 'w-full' : 'grid gap-6 lg:grid-cols-12 items-start'}>
        {/* DESKTOP SIDEBAR (Obsidian #0F1115 + Volt Lime #C8F135) */}
        {!embedded && (
        <aside
          aria-label="LoyaltyOS Desktop Sidebar"
          className="hidden lg:flex lg:col-span-3 flex-col justify-between overflow-hidden rounded-3xl border border-[#2D323B] bg-[#0F1115] text-[#F8F9FA] shadow-xl sticky top-6"
        >
          <div>
            <div className="h-1 w-full bg-[#C8F135]" />
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between gap-2 border-b border-[#2D323B] pb-4">
                <div className="flex items-center gap-3 min-w-0">
                  {uploadedLogo ? (
                    <img
                      src={uploadedLogo}
                      alt={`${business.name} logo`}
                      className="h-10 w-10 shrink-0 rounded-xl border border-[#2D323B] bg-[#171A20] object-contain p-0.5"
                    />
                  ) : (
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#C8F135] text-[#0F1115]">
                      <Star className="h-5 w-5 fill-current" aria-hidden />
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="text-[10px] font-extrabold uppercase tracking-[0.2em] text-[#C8F135]">
                      LOYALTYOS
                    </p>
                    <p className="truncate text-[14px] font-black text-[#F8F9FA]">
                      {business.name}
                    </p>
                  </div>
                </div>
                <Link
                  to="/setup?type=loyalty"
                  className="inline-flex items-center gap-1 rounded-lg border border-[#2D323B] bg-[#171A20] px-2.5 py-1 text-[11px] font-bold text-[#C8F135] hover:border-[#C8F135]"
                >
                  <Plus className="h-3 w-3" aria-hidden /> New
                </Link>
              </div>

              {loyaltyBusinesses.length > 0 && (
                <div className="space-y-1.5">
                  <span className="block text-[10.5px] font-bold uppercase tracking-wider text-[#A0A6B1]">
                    Active Loyalty Store
                  </span>
                  <div className="flex h-11 items-center gap-2 rounded-xl border border-[#2D323B] bg-[#171A20] px-3">
                    <Building2
                      className="h-4 w-4 shrink-0 text-[#C8F135]"
                      aria-hidden
                    />
                    <select
                      aria-label="Select LoyaltyOS business"
                      value={business.slug}
                      onChange={(e) => onSelectBusiness(e.target.value)}
                      className="w-full min-w-0 truncate bg-transparent text-[13px] font-bold text-[#F8F9FA] focus:outline-none cursor-pointer"
                    >
                      {loyaltyBusinesses.map((b) => (
                        <option
                          key={b.id}
                          value={b.slug}
                          className="bg-[#0F1115] text-[#F8F9FA]"
                        >
                          {b.name} ({b.city})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <nav className="flex flex-col gap-1.5">
                {navItems.map(({ id, label, Icon, badge }) => {
                  const active = activeTab === id;
                  return (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setActiveTab(id)}
                      className={`flex min-h-11 items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 text-[13px] font-bold transition-colors cursor-pointer ${
                        active
                          ? 'bg-[#C8F135] text-[#0F1115]'
                          : 'text-[#A0A6B1] hover:bg-[#171A20] hover:text-[#F8F9FA]'
                      }`}
                    >
                      <span className="flex items-center gap-3 min-w-0">
                        <Icon className="h-4 w-4 shrink-0" aria-hidden />
                        <span className="truncate">{label}</span>
                      </span>
                      {badge !== undefined && badge > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10.5px] font-black tabular-nums ${
                            active
                              ? 'bg-[#0F1115] text-[#C8F135]'
                              : 'bg-[#F59E0B] text-[#0F1115]'
                          }`}
                        >
                          {badge}
                        </span>
                      )}
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>

          <div className="border-t border-[#2D323B] bg-[#171A20] p-5 space-y-3">
            <div className="flex items-center justify-between gap-2 text-[11.5px]">
              <span
                className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-extrabold ${
                  isLive
                    ? 'bg-[#22C55E]/15 text-[#22C55E]'
                    : 'bg-[#F59E0B]/15 text-[#F59E0B]'
                }`}
              >
                {isLive ? 'Live Counter QR' : 'Pending Approval'}
              </span>
              <span className="text-[#A0A6B1] truncate">{business.city}</span>
            </div>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-10 w-full items-center justify-center gap-1.5 rounded-xl bg-[#20242C] border border-[#2D323B] text-[12px] font-bold text-[#C8F135] hover:border-[#C8F135]"
            >
              Open Customer Wallet <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
            {hasOtherBusinesses && (
              <Link
                to="/dashboard?view=restaurant"
                className="block text-center text-[11px] font-semibold text-[#A0A6B1] hover:text-[#F8F9FA]"
              >
                Switch Industry Workspace →
              </Link>
            )}
          </div>
        </aside>
        )}

        {/* MAIN RESPONSIVE WORKSPACE */}
        <div className={embedded ? 'w-full min-w-0 space-y-5' : 'lg:col-span-9 min-w-0 space-y-5'}>
          {/* Mobile Compact Header (Replaces shrunk desktop sidebar on phones) */}
          {!embedded && (
          <header className="lg:hidden rounded-2xl border border-[#2D323B] bg-[#0F1115] p-4 text-[#F8F9FA] space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                {uploadedLogo ? (
                  <img
                    src={uploadedLogo}
                    alt={`${business.name} logo`}
                    className="h-9 w-9 shrink-0 rounded-xl border border-[#2D323B] bg-[#171A20] object-contain p-0.5"
                  />
                ) : (
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#C8F135] text-[#0F1115]">
                    <Star className="h-4.5 w-4.5 fill-current" aria-hidden />
                  </span>
                )}
                <div className="min-w-0">
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.18em] text-[#C8F135]">
                    LOYALTYOS
                  </p>
                  <h1 className="truncate text-[15px] font-black text-[#F8F9FA]">
                    {business.name}
                  </h1>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <a
                  href={portalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#2D323B] bg-[#171A20] px-2.5 text-[11.5px] font-bold text-[#C8F135]"
                >
                  Wallet <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
                <button
                  type="button"
                  onClick={() => setActiveTab('settings')}
                  aria-label="Open loyalty settings"
                  className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#2D323B] bg-[#171A20] text-[#F8F9FA] cursor-pointer"
                >
                  <Settings className="h-4 w-4" aria-hidden />
                </button>
              </div>
            </div>

            {loyaltyBusinesses.length > 1 && (
              <select
                aria-label="Switch store"
                value={business.slug}
                onChange={(e) => onSelectBusiness(e.target.value)}
                className="h-10 w-full rounded-xl border border-[#2D323B] bg-[#171A20] px-3 text-[12.5px] font-bold text-[#F8F9FA]"
              >
                {loyaltyBusinesses.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            )}
          </header>
          )}

          {!isLive && (
            <div
              role="status"
              className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-[12.5px] text-amber-950"
            >
              <strong>Preview Mode:</strong> Approve <strong>{business.name}</strong>{' '}
              under <Link to="/admin" className="underline font-bold">Admin Panel → LoyaltyOS</Link> to activate your live public wallet at <span className="font-mono">/r/{business.slug}/loyalty</span>.
            </div>
          )}

          {toast && (
            <div
              role="status"
              className="flex items-center gap-2 rounded-2xl border border-[#22C55E]/35 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-900"
            >
              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#22C55E]" aria-hidden />
              <span>{toast}</span>
            </div>
          )}

          {errorMsg && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-[#EF4444]/35 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
            >
              <AlertCircle className="h-4 w-4 shrink-0 text-[#EF4444]" aria-hidden />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* ================= TAB 1: OVERVIEW (MOBILE-FIRST OPERATIONAL ORDER) ================= */}
          {activeTab === 'overview' && (
            <div className="space-y-5">
              {/* Compact Program Status Card */}
              <div className="rounded-2xl border border-[#2D323B] bg-[#0F1115] p-4 sm:p-5 text-[#F8F9FA] flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-[#22C55E]/15 px-2 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#22C55E]">
                      Active Program
                    </span>
                    <span className="text-[12px] text-[#A0A6B1]">
                      {categoryLabels[business.category]}
                    </span>
                  </div>
                  <p className="text-[17px] font-black text-[#FFFFFF]">
                    {dashboard?.config.starsRequired ?? 5} Stars →{' '}
                    <span className="text-[#C8F135]">
                      {dashboard?.config.rewardTitle ?? rewardTitle}
                    </span>
                  </p>
                  <p className="text-[12px] text-[#A0A6B1]">
                    {dashboard?.config.verificationMode === 'counter_pin'
                      ? `4-Digit Counter PIN active · ${dashboard.config.scanCooldownHours}h cooldown`
                      : dashboard?.config.verificationMode === 'cashier_approval'
                        ? `Live Cashier Approval required · ${dashboard.config.scanCooldownHours}h cooldown`
                        : `Cooldown protection enabled · ${dashboard?.config.scanCooldownHours ?? 12} hours`}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void loadData(false)}
                  className="inline-flex h-10 shrink-0 items-center justify-center gap-1.5 rounded-xl border border-[#2D323B] bg-[#171A20] px-3.5 text-[12px] font-bold text-[#F8F9FA] hover:border-[#C8F135] cursor-pointer"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} aria-hidden />
                  Sync Live
                </button>
              </div>

              {/* 4 KPI Cards (2-col mobile / 4-col desktop, tabular-nums, zero photos) */}
              <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1">
                  <span className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Total Members
                    <Users className="h-4.5 w-4.5 text-[#0F1115]" aria-hidden />
                  </span>
                  <p className="text-[26px] font-black text-[#0F1115] tabular-nums">
                    {dashboard?.kpis.totalMembers ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-4 space-y-1 text-[#F8F9FA]">
                  <span className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-[#A0A6B1]">
                    Stars This Month
                    <Star className="h-4.5 w-4.5 text-[#C8F135]" aria-hidden />
                  </span>
                  <p className="text-[26px] font-black text-[#C8F135] tabular-nums">
                    {dashboard?.kpis.starsIssuedThisMonth ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1">
                  <span className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Rewards Redeemed
                    <Gift className="h-4.5 w-4.5 text-[#22C55E]" aria-hidden />
                  </span>
                  <p className="text-[26px] font-black text-[#0F1115] tabular-nums">
                    {dashboard?.kpis.rewardsRedeemed ?? 0}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 space-y-1">
                  <span className="flex items-center justify-between text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                    Pending Actions
                    <Clock className="h-4.5 w-4.5 text-[#F59E0B]" aria-hidden />
                  </span>
                  <p className="text-[26px] font-black text-[#0F1115] tabular-nums">
                    {activeRedemptionRequests.length + pendingApprovals.length}
                  </p>
                </div>
              </div>

              {/* PRIORITY 1: IN-STORE REDEMPTION QUEUE (Collapses cleanly when 0) */}
              {pendingRedemptions.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-[#F8F9FA] px-4 py-3 flex items-center justify-between gap-2 text-[12.5px]">
                  <span className="font-semibold text-slate-600 flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-[#22C55E]" aria-hidden />
                    No pending reward redemptions — counter queue is clear
                  </span>
                </div>
              ) : (
                <section
                  aria-label="In-Store Reward Redemption Queue"
                  className="rounded-2xl border border-[#2D323B] bg-[#0F1115] p-4 sm:p-5 text-[#F8F9FA] space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <h2 className="text-[16px] font-black flex items-center gap-2">
                      <Gift className="h-4.5 w-4.5 text-[#C8F135]" aria-hidden />
                      Counter Reward Verification ({pendingRedemptions.length})
                    </h2>
                    <span className="text-[11px] font-bold text-[#A0A6B1]">
                      Verify 4-digit code on guest phone
                    </span>
                  </div>

                  <div className="space-y-2.5">
                    {pendingRedemptions.map((card) => (
                      <div
                        key={card.id}
                        className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="space-y-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-black text-[15px] text-[#F8F9FA]">
                              {card.customerName}
                            </span>
                            <span className="rounded-md bg-[#20242C] px-2 py-0.5 font-mono text-[11px] font-bold text-[#A0A6B1]">
                              {card.memberCode}
                            </span>
                            {card.pendingRedemptionCode ? (
                              <span className="rounded-md bg-[#C8F135] px-2.5 py-0.5 font-mono text-[12px] font-black text-[#0F1115]">
                                CODE #{card.pendingRedemptionCode}
                              </span>
                            ) : (
                              <span className="rounded-md bg-[#22C55E]/20 px-2 py-0.5 text-[11px] font-extrabold text-[#22C55E]">
                                {card.rewardsUnlocked} Ready at Desk
                              </span>
                            )}
                          </div>
                          <p className="text-[12.5px] text-[#A0A6B1] truncate">
                            {dashboard?.config.rewardTitle ?? rewardTitle} · {card.phone}
                          </p>
                        </div>

                        <button
                          type="button"
                          disabled={busyCardId === card.id}
                          onClick={() => void handleConfirmRedemption(card)}
                          className="flex min-h-[46px] sm:w-auto w-full items-center justify-center gap-1.5 rounded-xl bg-[#22C55E] px-5 text-[13px] font-black text-[#0F1115] hover:bg-emerald-400 cursor-pointer shrink-0"
                        >
                          <Check className="h-4 w-4" aria-hidden />
                          {busyCardId === card.id ? 'Redeeming…' : 'Verify & Redeem'}
                        </button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {/* PRIORITY 2: PENDING STAR APPROVALS (When cashier_approval mode / queue active) */}
              {(verificationMode === 'cashier_approval' ||
                pendingApprovals.length > 0) && (
                <section
                  aria-label="Pending Visit Star Approvals"
                  className="rounded-2xl border border-amber-300 bg-amber-50 p-4 sm:p-5 space-y-3"
                >
                  <h2 className="text-[15.5px] font-black text-[#0F1115] flex items-center gap-2">
                    <Clock className="h-4.5 w-4.5 text-[#F59E0B]" aria-hidden />
                    Pending Cashier Approvals ({pendingApprovals.length})
                  </h2>

                  {pendingApprovals.length === 0 ? (
                    <p className="text-[12.5px] text-amber-900">
                      No guests waiting for counter star approval right now.
                    </p>
                  ) : (
                    <div className="space-y-2.5">
                      {pendingApprovals.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded-xl border border-amber-200 bg-white p-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
                        >
                          <div>
                            <p className="text-[14.5px] font-extrabold text-[#0F1115]">
                              {ev.customerName ?? 'Guest'}{' '}
                              <span className="font-mono text-[12px] text-slate-500">
                                ({ev.memberCode ?? 'STAR'} · {ev.phone})
                              </span>
                            </p>
                            <p className="text-[11.5px] text-slate-500">
                              Scanned via QR/NFC ·{' '}
                              {new Date(ev.createdAt).toLocaleTimeString([], {
                                hour: 'numeric',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>

                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              type="button"
                              disabled={busyEventId === ev.id}
                              onClick={() =>
                                void handleApprovalDecision(ev.id, 'approved')
                              }
                              className="inline-flex h-10 flex-1 sm:flex-none items-center justify-center gap-1 rounded-xl bg-[#0F1115] px-4 text-[12.5px] font-extrabold text-[#C8F135] cursor-pointer"
                            >
                              <Check className="h-3.5 w-3.5" aria-hidden />
                              Approve +1 Star
                            </button>
                            <button
                              type="button"
                              disabled={busyEventId === ev.id}
                              onClick={() =>
                                void handleApprovalDecision(ev.id, 'rejected')
                              }
                              className="inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-bold text-red-700 cursor-pointer"
                            >
                              <XCircle className="h-3.5 w-3.5" aria-hidden />
                              Reject
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>
              )}

              {/* SECONDARY 7-DAY PURE CSS STAR ACTIVITY CHART (Zero extra chart packages) */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[15.5px] font-black text-[#0F1115] flex items-center gap-2">
                      <BarChart3 className="h-4.5 w-4.5 text-[#0F1115]" aria-hidden />
                      7-Day Loyalty Stars Earned
                    </h2>
                    <p className="text-[12px] text-slate-500">
                      Real verified visit &amp; desk star activity
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActiveTab('members')}
                    className="text-[12px] font-bold text-[#0F1115] hover:underline cursor-pointer"
                  >
                    Open Members →
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 items-end h-28 pt-2">
                  {chartDays.map((day, idx) => {
                    const hPct =
                      day.stars > 0
                        ? Math.max(16, Math.round((day.stars / maxDayStars) * 100))
                        : 8;
                    return (
                      <div key={idx} className="flex flex-col items-center gap-1.5 h-full justify-end">
                        <span className="text-[10.5px] font-extrabold text-slate-600 tabular-nums">
                          {day.stars}
                        </span>
                        <div className="w-full max-w-[34px] h-16 flex items-end rounded-lg bg-slate-100 overflow-hidden">
                          <div
                            className="w-full rounded-t-lg transition-all duration-300"
                            style={{
                              height: `${hPct}%`,
                              backgroundColor: day.stars > 0 ? '#C8F135' : '#E2E8F0',
                            }}
                          />
                        </div>
                        <span className="text-[10px] font-bold text-slate-500">
                          {day.label}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {/* ================= TAB 2: MEMBERS DIRECTORY & DESK STAR ISSUER ================= */}
          {activeTab === 'members' && (
            <div className="space-y-5">
              {/* Mobile & Desktop Quick Desk Star Issuer */}
              <form
                onSubmit={(e) => void handleIssueDeskStar(e)}
                className="rounded-2xl border border-[#2D323B] bg-[#0F1115] p-5 text-[#F8F9FA] space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-[16px] font-black flex items-center gap-2">
                      <UserPlus className="h-4.5 w-4.5 text-[#C8F135]" aria-hidden />
                      Issue a Desk Star (Walk-In / Cash Register)
                    </h2>
                    <p className="text-[12px] text-[#A0A6B1]">
                      Award +1 ★ directly for customers without a smartphone handy.
                    </p>
                  </div>
                </div>

                <div className="grid gap-2.5 sm:grid-cols-12">
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Customer Name"
                    value={deskName}
                    onChange={(e) => setDeskName(e.target.value)}
                    className="sm:col-span-4 h-11 rounded-xl border border-[#2D323B] bg-[#171A20] px-3 text-[13px] font-semibold text-[#F8F9FA]"
                  />
                  <input
                    type="tel"
                    required
                    maxLength={20}
                    placeholder="Mobile Number *"
                    value={deskPhone}
                    onChange={(e) => setDeskPhone(e.target.value)}
                    className="sm:col-span-4 h-11 rounded-xl border border-[#2D323B] bg-[#171A20] px-3 text-[13px] font-semibold text-[#F8F9FA]"
                  />
                  <input
                    type="text"
                    maxLength={80}
                    placeholder="Note (optional)"
                    value={deskNote}
                    onChange={(e) => setDeskNote(e.target.value)}
                    className="sm:col-span-2 h-11 rounded-xl border border-[#2D323B] bg-[#171A20] px-3 text-[12.5px] text-[#F8F9FA]"
                  />
                  <button
                    type="submit"
                    disabled={issuingDeskStar}
                    className="sm:col-span-2 inline-flex h-11 items-center justify-center gap-1 rounded-xl bg-[#C8F135] px-4 text-[13px] font-black text-[#0F1115] cursor-pointer"
                  >
                    +1 Star
                  </button>
                </div>
              </form>

              {/* Search Bar */}
              <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 h-12">
                <Search className="h-4 w-4 text-slate-400 shrink-0" aria-hidden />
                <input
                  type="text"
                  value={memberSearch}
                  onChange={(e) => setMemberSearch(e.target.value)}
                  placeholder="Search name, mobile number, or STAR-001…"
                  className="w-full bg-transparent text-[13.5px] font-semibold text-[#0F1115] focus:outline-none"
                />
              </div>

              {filteredMembers.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-center space-y-2">
                  <Users className="mx-auto h-7 w-7 text-slate-400" aria-hidden />
                  <p className="text-[14px] font-bold text-[#0F1115]">
                    No loyalty members matched
                  </p>
                  <p className="text-[12.5px] text-slate-500">
                    Share your Counter QR or issue your first Desk Star above.
                  </p>
                </div>
              ) : (
                <>
                  {/* Mobile Member Card List (Never table on mobile!) */}
                  <div className="md:hidden space-y-2.5">
                    {filteredMembers.map((m) => {
                      const pct = Math.min(
                        100,
                        Math.round((m.currentStars / starsRequired) * 100),
                      );
                      return (
                        <button
                          key={m.id}
                          type="button"
                          onClick={() => setSelectedMemberId(m.id)}
                          className="w-full text-left rounded-2xl border border-slate-200 bg-white p-4 space-y-2.5 cursor-pointer"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div>
                              <p className="text-[15px] font-extrabold text-[#0F1115]">
                                {m.customerName}
                              </p>
                              <p className="text-[12px] text-slate-500 font-mono">
                                {m.memberCode} · {m.phone}
                              </p>
                            </div>
                            <span className="rounded-full bg-[#0F1115] px-2.5 py-0.5 text-[11px] font-extrabold text-[#C8F135] tabular-nums">
                              {m.currentStars} / {starsRequired} ★
                            </span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className="h-full rounded-full bg-[#C8F135]"
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <div className="flex items-center justify-between text-[11.5px] font-semibold text-slate-500">
                            <span>
                              {m.rewardsUnlocked > 0
                                ? `🎁 ${m.rewardsUnlocked} reward available`
                                : `Lifetime: ${m.lifetimeStars} ★`}
                            </span>
                            <span className="text-[#0F1115] font-bold">Details →</span>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Desktop Member Table */}
                  <div className="hidden md:block overflow-hidden rounded-2xl border border-slate-200 bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
                          <th className="px-4 py-3">Member</th>
                          <th className="px-4 py-3">Phone</th>
                          <th className="px-4 py-3">Progress</th>
                          <th className="px-4 py-3">Rewards</th>
                          <th className="px-4 py-3 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[13px]">
                        {filteredMembers.map((m) => (
                          <tr key={m.id} className="hover:bg-slate-50/80">
                            <td className="px-4 py-3">
                              <p className="font-extrabold text-[#0F1115]">
                                {m.customerName}
                              </p>
                              <p className="font-mono text-[11px] text-slate-500">
                                {m.memberCode}
                              </p>
                            </td>
                            <td className="px-4 py-3 font-mono text-[12.5px] text-slate-600">
                              {m.phone}
                            </td>
                            <td className="px-4 py-3 tabular-nums font-bold">
                              {m.currentStars} / {starsRequired} ★ (Life: {m.lifetimeStars})
                            </td>
                            <td className="px-4 py-3">
                              {m.rewardsUnlocked > 0 ? (
                                <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-[11px] font-extrabold text-emerald-800">
                                  {m.rewardsUnlocked} Ready
                                </span>
                              ) : (
                                <span className="text-slate-400 text-[12px]">
                                  {m.rewardsRedeemed} redeemed
                                </span>
                              )}
                            </td>
                            <td className="px-4 py-3 text-right space-x-2 whitespace-nowrap">
                              <button
                                type="button"
                                disabled={issuingDeskStar}
                                onClick={() => void handleIssueDeskStar(undefined, m)}
                                className="inline-flex h-8 items-center rounded-lg bg-[#0F1115] px-3 text-[11.5px] font-extrabold text-[#C8F135] cursor-pointer"
                              >
                                +1 Desk ★
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedMemberId(m.id)}
                                className="inline-flex h-8 items-center rounded-lg border border-slate-200 px-2.5 text-[11.5px] font-bold text-slate-700 cursor-pointer"
                              >
                                View
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}

              {/* Member Detail Drawer / Card */}
              {selectedMember && (
                <div className="rounded-2xl border border-[#2D323B] bg-[#0F1115] p-5 text-[#F8F9FA] space-y-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-[#C8F135]">
                        {selectedMember.memberCode}
                      </span>
                      <h3 className="text-[19px] font-black">
                        {selectedMember.customerName}
                      </h3>
                      <p className="text-[12.5px] text-[#A0A6B1]">
                        {selectedMember.phone}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedMemberId(null)}
                      aria-label="Close member details"
                      className="rounded-lg border border-[#2D323B] p-1.5 text-[#A0A6B1] cursor-pointer"
                    >
                      <X className="h-4 w-4" aria-hidden />
                    </button>
                  </div>

                  <div className="grid grid-cols-4 gap-2 text-center">
                    <div className="rounded-xl bg-[#171A20] p-2.5">
                      <p className="text-[17px] font-black text-[#C8F135] tabular-nums">
                        {selectedMember.currentStars}
                      </p>
                      <p className="text-[10px] text-[#A0A6B1]">Current ★</p>
                    </div>
                    <div className="rounded-xl bg-[#171A20] p-2.5">
                      <p className="text-[17px] font-black tabular-nums">
                        {selectedMember.lifetimeStars}
                      </p>
                      <p className="text-[10px] text-[#A0A6B1]">Lifetime ★</p>
                    </div>
                    <div className="rounded-xl bg-[#171A20] p-2.5">
                      <p className="text-[17px] font-black text-[#22C55E] tabular-nums">
                        {selectedMember.rewardsUnlocked}
                      </p>
                      <p className="text-[10px] text-[#A0A6B1]">Unlocked</p>
                    </div>
                    <div className="rounded-xl bg-[#171A20] p-2.5">
                      <p className="text-[17px] font-black tabular-nums">
                        {selectedMember.rewardsRedeemed}
                      </p>
                      <p className="text-[10px] text-[#A0A6B1]">Redeemed</p>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#A0A6B1]">
                      Recent Events
                    </p>
                    {recentFeed
                      .filter((ev) => ev.cardId === selectedMember.id)
                      .slice(0, 6)
                      .map((ev) => (
                        <div
                          key={ev.id}
                          className="flex items-center justify-between rounded-xl border border-[#2D323B] bg-[#171A20] px-3 py-2 text-[12px]"
                        >
                          <span>
                            {ev.eventType.replace(/_/g, ' ')} ({ev.status})
                          </span>
                          <span className="text-[#A0A6B1] text-[11px]">
                            {new Date(ev.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                      ))}
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={issuingDeskStar}
                      onClick={() => void handleIssueDeskStar(undefined, selectedMember)}
                      className="flex-1 min-h-11 rounded-xl bg-[#C8F135] px-4 text-[13px] font-black text-[#0F1115] cursor-pointer"
                    >
                      +1 Desk Star
                    </button>
                    {selectedMember.rewardsUnlocked > 0 && (
                      <button
                        type="button"
                        disabled={busyCardId === selectedMember.id}
                        onClick={() => void handleConfirmRedemption(selectedMember)}
                        className="flex-1 min-h-11 rounded-xl bg-[#22C55E] px-4 text-[13px] font-black text-[#0F1115] cursor-pointer"
                      >
                        Redeem Reward ✓
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* ================= TAB 3: REWARDS & ACTIVITY ================= */}
          {activeTab === 'rewards' && (
            <div className="space-y-5">
              {/* Live Customer Card Preview */}
              <div className="rounded-2xl border border-[#2D323B] bg-[#0F1115] p-5 text-[#F8F9FA] space-y-3">
                <p className="text-[10.5px] font-extrabold uppercase tracking-[0.18em] text-[#A0A6B1]">
                  CUSTOMER WALLET PREVIEW
                </p>
                <div className="rounded-2xl border border-[#2D323B] bg-[#171A20] p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-[18px] font-black">
                      0 / {starsRequired} Stars
                    </p>
                    <span
                      className="rounded-lg px-2.5 py-0.5 text-[11px] font-black"
                      style={{ backgroundColor: brandAccentHex, color: '#0F1115' }}
                    >
                      STAR-001
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-[#F8F9FA]">
                    🎁 {rewardTitle}
                  </p>
                  {rewardDesc && (
                    <p className="text-[12px] text-[#A0A6B1]">{rewardDesc}</p>
                  )}
                </div>
              </div>

              {/* Recent Activity Feed */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 space-y-3">
                <h2 className="text-[16px] font-black text-[#0F1115] flex items-center gap-2">
                  <Activity className="h-4.5 w-4.5 text-[#0F1115]" aria-hidden />
                  Store Loyalty &amp; Redemption Log ({recentFeed.length})
                </h2>
                {recentFeed.length === 0 ? (
                  <p className="text-[13px] text-slate-500 py-4 text-center">
                    No star or redemption activity recorded yet.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {recentFeed.map((ev) => (
                      <div
                        key={ev.id}
                        className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-[#F8F9FA] px-3.5 py-2.5 text-[12.5px]"
                      >
                        <div className="min-w-0">
                          <p className="font-bold text-[#0F1115] truncate">
                            {ev.customerName ?? 'Member'}{' '}
                            <span className="font-mono text-[11px] text-slate-500">
                              ({ev.memberCode ?? 'STAR'})
                            </span>{' '}
                            — {ev.eventType.replace(/_/g, ' ')}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {new Date(ev.createdAt).toLocaleString()} · {ev.status}
                          </p>
                        </div>
                        {ev.starsDelta > 0 && (
                          <span className="shrink-0 font-black text-emerald-700 tabular-nums">
                            +{ev.starsDelta} ★
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================= TAB 4: PROGRAM & ANTI-FRAUD SETTINGS ================= */}
          {activeTab === 'settings' && (
            <form
              onSubmit={(e) => void handleSaveSettings(e)}
              className="space-y-5"
            >
              {/* Section A: Reward Rules */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
                <h2 className="text-[17px] font-black text-[#0F1115] flex items-center gap-2">
                  <Gift className="h-5 w-5 text-[#0F1115]" aria-hidden />
                  Reward Configuration
                </h2>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <label
                      htmlFor="loyaltyStarsSlider"
                      className="text-[12.5px] font-bold text-[#0F1115]"
                    >
                      Stars Required to Unlock Reward
                    </label>
                    <span className="rounded-lg bg-[#0F1115] px-3 py-1 text-[13px] font-black text-[#C8F135] tabular-nums">
                      {starsRequired} Stars
                    </span>
                  </div>
                  <input
                    id="loyaltyStarsSlider"
                    type="range"
                    min={3}
                    max={20}
                    value={starsRequired}
                    onChange={(e) => setStarsRequired(Number(e.target.value))}
                    className="w-full accent-[#0F1115] cursor-pointer"
                  />
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="space-y-1">
                    <label className="block text-[12px] font-bold text-slate-600">
                      Reward Title *
                    </label>
                    <input
                      type="text"
                      required
                      maxLength={100}
                      value={rewardTitle}
                      onChange={(e) => setRewardTitle(e.target.value)}
                      className="h-11 w-full rounded-xl border border-slate-300 px-3 text-[13.5px] font-bold text-[#0F1115]"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="block text-[12px] font-bold text-slate-600">
                      Wallet Accent Color
                    </label>
                    <div className="flex items-center gap-2 h-11">
                      {ACCENT_PRESETS.map((p) => (
                        <button
                          key={p.hex}
                          type="button"
                          onClick={() => setBrandAccentHex(p.hex)}
                          aria-label={p.label}
                          className={`h-8 w-8 rounded-full border-2 cursor-pointer ${
                            brandAccentHex === p.hex
                              ? 'border-[#0F1115] scale-110'
                              : 'border-slate-200'
                          }`}
                          style={{ backgroundColor: p.hex }}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="block text-[12px] font-bold text-slate-600">
                    Reward Terms / Instructions (Optional)
                  </label>
                  <textarea
                    rows={2}
                    maxLength={160}
                    value={rewardDesc}
                    onChange={(e) => setRewardDesc(e.target.value)}
                    placeholder="e.g. Valid on any signature order or treatment over ₹499"
                    className="w-full rounded-xl border border-slate-300 p-3 text-[13px] text-[#0F1115]"
                  />
                </div>
              </div>

              {/* Section B: Anti-Fraud Shield */}
              <div className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6 space-y-4">
                <h2 className="text-[17px] font-black text-[#0F1115] flex items-center gap-2">
                  <ShieldCheck className="h-5 w-5 text-[#22C55E]" aria-hidden />
                  Anti-Fraud Verification &amp; Cooldown
                </h2>

                <div className="grid gap-2.5 sm:grid-cols-3">
                  {(
                    [
                      [
                        'cooldown_only',
                        'Cooldown Only',
                        '1-tap instant scan protected by visit hours cooldown',
                      ],
                      [
                        'counter_pin',
                        '4-Digit Counter PIN',
                        'Cashier gives guest today’s register PIN to claim star',
                      ],
                      [
                        'cashier_approval',
                        'Live Cashier Approval',
                        'Staff taps Approve ✓ on dashboard for every scan',
                      ],
                    ] as const
                  ).map(([mode, title, desc]) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setVerificationMode(mode)}
                      className={`rounded-xl border p-3.5 text-left transition-colors cursor-pointer ${
                        verificationMode === mode
                          ? 'border-2 border-[#0F1115] bg-[#0F1115] text-[#F8F9FA]'
                          : 'border-slate-200 bg-[#F8F9FA] text-[#0F1115]'
                      }`}
                    >
                      <p className="text-[13px] font-extrabold">{title}</p>
                      <p
                        className={`mt-1 text-[11.5px] ${
                          verificationMode === mode
                            ? 'text-[#A0A6B1]'
                            : 'text-slate-500'
                        }`}
                      >
                        {desc}
                      </p>
                    </button>
                  ))}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="block text-[12px] font-bold text-slate-600">
                      Visit Cooldown Hours (1–168h)
                    </label>
                    <div className="flex flex-wrap items-center gap-2">
                      {[12, 24, 48].map((h) => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => setCooldownHours(h)}
                          className={`h-9 rounded-lg border px-3 text-[12px] font-bold cursor-pointer ${
                            cooldownHours === h
                              ? 'border-[#0F1115] bg-[#0F1115] text-[#C8F135]'
                              : 'border-slate-200 bg-white text-slate-700'
                          }`}
                        >
                          {h}h
                        </button>
                      ))}
                      <input
                        type="number"
                        min={1}
                        max={168}
                        value={cooldownHours}
                        onChange={(e) =>
                          setCooldownHours(
                            Math.max(1, Math.min(168, Number(e.target.value) || 12)),
                          )
                        }
                        className="h-9 w-20 rounded-lg border border-slate-300 px-2.5 text-[13px] font-bold"
                      />
                    </div>
                  </div>

                  {verificationMode === 'counter_pin' && (
                    <div className="space-y-1.5">
                      <label className="flex items-center gap-1.5 text-[12px] font-bold text-slate-600">
                        <KeyRound className="h-3.5 w-3.5" aria-hidden />
                        Register 4–6 Digit Counter PIN
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        maxLength={6}
                        value={counterPin}
                        onChange={(e) =>
                          setCounterPin(e.target.value.replace(/\D/g, '').slice(0, 6))
                        }
                        className="h-10 w-40 rounded-xl border border-slate-300 px-3 font-mono text-[16px] font-black tracking-widest text-[#0F1115]"
                      />
                    </div>
                  )}
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={savingSettings}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-[#0F1115] px-6 text-[13.5px] font-black text-[#C8F135] hover:bg-slate-800 cursor-pointer"
                  >
                    {savingSettings ? 'Saving Rules…' : 'Save Program & Security'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* ================= TAB 5: COUNTER QR STANDEE & EXISTING AI REVIEWS SUITE ================= */}
          {activeTab === 'ai_reviews' && (
            <div className="space-y-5">
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
                <div>
                  <h2 className="text-[17px] font-black text-[#0F1115] flex items-center gap-2">
                    <Sparkles className="h-4.5 w-4.5 text-[#0F1115]" aria-hidden />
                    Counter QR Standee &amp; AI Google Review Suite
                  </h2>
                  <p className="text-[12px] text-slate-500">
                    Reuses your standalone AI drafting, analytics funnel, and printable standee studio.
                  </p>
                </div>
                <div className="inline-flex rounded-xl border border-slate-200 bg-[#F8F9FA] p-1">
                  {(
                    [
                      ['qr', 'QR Standee'],
                      ['drafts', `Drafts (${drafts.length})`],
                      ['analytics', 'Funnel'],
                      ['config', 'Google & AI'],
                    ] as const
                  ).map(([k, lbl]) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => setAiSubTab(k)}
                      className={`rounded-lg px-3 py-1.5 text-[12px] font-bold cursor-pointer ${
                        aiSubTab === k
                          ? 'bg-[#0F1115] text-[#C8F135]'
                          : 'text-slate-600'
                      }`}
                    >
                      {lbl}
                    </button>
                  ))}
                </div>
              </div>

              {aiSubTab === 'qr' && (
                <QRCodeManager
                  key={`loyalty-qr-${business.id}`}
                  business={business}
                  defaultMode="loyalty"
                />
              )}

              {aiSubTab === 'drafts' && (
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

              {aiSubTab === 'analytics' && (
                <AnalyticsView
                  metrics={metrics}
                  events={events}
                  businessName={business.name}
                />
              )}

              {aiSubTab === 'config' && (
                <div className="space-y-5">
                  <GoogleUrlSettings
                    key={`loy-google-${business.id}`}
                    business={business}
                    onUpdated={onBusinessUpdated}
                  />
                  <BusinessCategorySettings
                    key={`loy-cat-${business.id}`}
                    business={business}
                    onUpdated={onBusinessUpdated}
                  />
                  <AIConfigurationSettings
                    key={`loy-ai-${business.id}`}
                    business={business}
                  />
                  <BusinessKnowledgeSettings
                    key={`loy-knowledge-${business.id}`}
                    business={business}
                  />
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      {!embedded && (
      <nav
        aria-label="LoyaltyOS Mobile Navigation"
        className="lg:hidden fixed bottom-0 inset-x-0 z-40 border-t border-[#2D323B] bg-[#0F1115]/95 backdrop-blur px-2 py-2"
      >
        <div className="mx-auto flex max-w-md items-center justify-around gap-1">
          {navItems.map(({ id, shortLabel, Icon, badge }) => {
            const active = activeTab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setActiveTab(id)}
                className={`relative flex flex-col items-center gap-0.5 rounded-xl px-2.5 py-1.5 text-[10.5px] font-bold cursor-pointer ${
                  active ? 'text-[#C8F135]' : 'text-[#A0A6B1]'
                }`}
              >
                <Icon className="h-4.5 w-4.5" aria-hidden />
                <span>{shortLabel}</span>
                {badge !== undefined && badge > 0 && (
                  <span className="absolute -right-0.5 top-0.5 h-4 min-w-4 rounded-full bg-[#F59E0B] px-1 text-[9px] font-black text-[#0F1115] leading-4 text-center">
                    {badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </nav>
      )}
    </div>
  );
}
