import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  Gamepad2,
  Sparkles,
  MessageSquare,
  Settings,
  BarChart3,
  ExternalLink,
  Clock,
  ShieldAlert,
  Ban,
  CheckCircle2,
  UserCheck,
  Users,
  Package,
  TrendingUp,
  Star,
} from 'lucide-react';
import type {
  Business,
  BusinessMetrics,
  AnalyticsEvent,
  CustomerDraftRecord,
} from '../types/business';
import { businessRepository } from '../services/storage';
import { categoryLabels } from '../services/business/mockBusinesses';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { QRCodeManager } from '../components/dashboard/QRCodeManager';
import { CustomerDraftsView } from '../components/dashboard/CustomerDraftsView';
import { GoogleUrlSettings } from '../components/dashboard/GoogleUrlSettings';
import { BusinessCategorySettings } from '../components/dashboard/BusinessCategorySettings';
import { AIConfigurationSettings } from '../components/dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../components/dashboard/BusinessKnowledgeSettings';
import {
  RestaurantManagerView,
  type RestaurantWorkspaceSection,
} from '../components/dashboard/RestaurantManagerView';
import { BarberOwnerWorkspace } from '../components/barber/BarberOwnerWorkspace';
import { GymOwnerWorkspace } from '../components/gym/GymOwnerWorkspace';
import { CafeManagerView } from '../components/cafe/CafeManagerView';
import { LoyaltyManagerView } from '../components/loyalty/LoyaltyManagerView';
import { ClinicManagerView } from '../components/ClinicManagerView';
import { getIndustryWorkspaceType } from '../utils/gymValidation';
import { isCafeCategory } from '../utils/cafeValidation';
import { isLoyaltyCategory } from '../utils/loyaltyValidation';
import { isClinicCategory } from '../utils/clinicValidation';
import {
  loadWorkspaceModules,
  saveWorkspaceModules,
  type WorkspaceModuleVisibility,
} from '../utils/workspaceModules';

type PrimaryDestination =
  | 'overview'
  | 'analytics'
  | 'menu'
  | 'tables'
  | 'ai_reviews'
  | 'loyalty_stars'
  | 'staff'
  | 'inventory'
  | 'games_loyalty'
  | 'settings';

type AiReviewSubTab = 'drafts' | 'qr' | 'analytics' | 'settings';

function parseDestinationFromParam(param: string | null): {
  destination: PrimaryDestination;
  aiSubTab?: AiReviewSubTab;
} {
  switch (param) {
    case 'analytics':
      return { destination: 'analytics' };
    case 'menu':
      return { destination: 'menu' };
    case 'staff':
      return { destination: 'staff' };
    case 'inventory':
      return { destination: 'inventory' };
    case 'tables':
      return { destination: 'tables' };
    case 'games_loyalty':
      return { destination: 'games_loyalty' };
    case 'settings':
      return { destination: 'settings' };
    case 'loyalty_stars':
    case 'loyalty':
      return { destination: 'loyalty_stars' };
    case 'ai_reviews':
    case 'drafts':
      return { destination: 'ai_reviews', aiSubTab: 'drafts' };
    case 'qr':
      return { destination: 'ai_reviews', aiSubTab: 'qr' };
    case 'review_analytics':
      return { destination: 'ai_reviews', aiSubTab: 'analytics' };
    case 'review_settings':
      return { destination: 'ai_reviews', aiSubTab: 'settings' };
    case 'restaurant':
    case 'overview':
    default:
      return { destination: 'overview' };
  }
}

export default function BusinessDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialParsed = parseDestinationFromParam(searchParams.get('tab'));

  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(
    searchParams.get('slug') || 'the-urban-kitchen',
  );
  const [destination, setDestination] = useState<PrimaryDestination>(
    initialParsed.destination,
  );
  const [aiSubTab, setAiSubTab] = useState<AiReviewSubTab>(
    initialParsed.aiSubTab ?? 'drafts',
  );
  const [loading, setLoading] = useState(true);
  const [togglingLoyalty, setTogglingLoyalty] = useState(false);
  const [loyaltyToast, setLoyaltyToast] = useState<string | null>(null);
  const [moduleOverrides, setModuleOverrides] = useState<
    Record<string, WorkspaceModuleVisibility>
  >({});

  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true);
      const list = await businessRepository.getBusinesses();
      setBusinesses(list);

      const paramSlug = searchParams.get('slug');
      const paramView = searchParams.get('view');
      if (paramSlug) {
        const match = list.find((b) => b.slug === paramSlug);
        if (match) {
          setSelectedSlug(match.slug);
        }
      } else if (paramView === 'restaurant') {
        const firstRest = list.find(
          (b) => getIndustryWorkspaceType(b.category) === 'restaurant',
        );
        if (firstRest) {
          setSelectedSlug(firstRest.slug);
        } else if (list.length > 0) {
          setSelectedSlug(list[0].slug);
        }
      } else if (list.length > 0) {
        setSelectedSlug((prev) =>
          list.some((b) => b.slug === prev) ? prev : list[0].slug,
        );
      }
      setLoading(false);
    }
    void loadBusinesses();
  }, [searchParams]);

  const currentBusiness =
    businesses.find((b) => b.slug === selectedSlug) ?? businesses[0];

  const moduleVisibility: WorkspaceModuleVisibility = currentBusiness
    ? (moduleOverrides[currentBusiness.id] ??
      loadWorkspaceModules(currentBusiness.id))
    : loadWorkspaceModules('');

  function handleUpdateModules(next: WorkspaceModuleVisibility) {
    if (!currentBusiness) return;
    saveWorkspaceModules(currentBusiness.id, next);
    setModuleOverrides((prev) => ({
      ...prev,
      [currentBusiness.id]: next,
    }));
  }

  useEffect(() => {
    if (!currentBusiness) return;

    async function loadBusinessData() {
      const [m, evts, drfts] = await Promise.all([
        businessRepository.getMetrics(currentBusiness.id),
        businessRepository.getEvents(currentBusiness.id),
        businessRepository.getDrafts(currentBusiness.id),
      ]);
      setMetrics(m);
      setEvents(evts);
      setDrafts(drfts);
    }

    void loadBusinessData();
  }, [currentBusiness]);

  function handleSelectBusiness(newSlug: string) {
    setSelectedSlug(newSlug);
    setSearchParams({ slug: newSlug, tab: destination });
  }

  function handleDestinationChange(next: PrimaryDestination) {
    setDestination(next);
    if (currentBusiness) {
      setSearchParams({ slug: currentBusiness.slug, tab: next });
    }
  }

  function handleBusinessUpdated(updated: Business) {
    setBusinesses((prev) =>
      prev.map((b) => (b.id === updated.id ? updated : b)),
    );
  }

  async function handleToggleLoyaltyEnabled(nextEnabled: boolean) {
    if (!currentBusiness || togglingLoyalty) return;
    setTogglingLoyalty(true);
    try {
      const updated = await businessRepository.setBusinessLoyaltyEnabled(
        currentBusiness.id,
        nextEnabled,
      );
      handleBusinessUpdated(updated);
      if (!nextEnabled && destination === 'loyalty_stars') {
        handleDestinationChange('ai_reviews');
      }
      const msg = nextEnabled
        ? 'Loyalty & Star Rewards enabled! Customers can now collect stars alongside Google Reviews.'
        : 'Loyalty & Star Rewards turned OFF — workspace is now focused purely on AI Google Reviews.';
      setLoyaltyToast(msg);
      window.setTimeout(() => {
        setLoyaltyToast((prev) => (prev === msg ? null : prev));
      }, 4000);
    } finally {
      setTogglingLoyalty(false);
    }
  }

  if (loading) {
    return (
      <div className="py-20 text-center" role="status" aria-live="polite">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-medium text-[#6B7280]">
          Loading workspace…
        </p>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="mx-auto max-w-xl px-4 py-12">
        <div className="rounded-xl border border-slate-200 bg-white py-14 px-6 text-center">
          <Building2 className="mx-auto h-10 w-10 text-slate-400" aria-hidden />
          <h2 className="mt-3 text-[19px] font-bold text-[#111827]">
            No Property Registered
          </h2>
          <p className="mt-1 text-[14px] text-slate-500">
            Set up your restaurant or hotel workspace to launch live floor management, digital menus, and AI reviews.
          </p>
          <Link
            to="/setup"
            className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-5 text-[13.5px] font-semibold text-[#FFFFFF] hover:bg-[#2E2A6E] transition-colors"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add Property
          </Link>
        </div>
      </div>
    );
  }

  // SMART MULTI-INDUSTRY WORKSPACE ROUTER
  const workspaceType = getIndustryWorkspaceType(currentBusiness.category);
  if (workspaceType === 'cafe') {
    return (
      <CafeManagerView
        key={currentBusiness.id}
        business={currentBusiness}
        cafeBusinesses={businesses}
        hasOtherBusinesses={businesses.some((b) => !isCafeCategory(b.category))}
        onSelectBusiness={handleSelectBusiness}
        onBusinessUpdated={handleBusinessUpdated}
      />
    );
  }
  if (workspaceType === 'barber') {
    const barberOnlyBusinesses = businesses.filter(
      (b) => getIndustryWorkspaceType(b.category) === 'barber',
    );
    return (
      <div className="px-4 py-5 sm:px-6">
        <BarberOwnerWorkspace
          key={currentBusiness.id}
          business={currentBusiness}
          barberBusinesses={
            barberOnlyBusinesses.length > 0 ? barberOnlyBusinesses : [currentBusiness]
          }
          hasRestaurantBusinesses={businesses.some(
            (b) => getIndustryWorkspaceType(b.category) === 'restaurant',
          )}
          onSelectBusiness={handleSelectBusiness}
          onBusinessUpdated={handleBusinessUpdated}
        />
      </div>
    );
  }
  if (workspaceType === 'gym') {
    return (
      <GymOwnerWorkspace
        key={currentBusiness.id}
        business={currentBusiness}
        gymBusinesses={businesses}
        hasOtherBusinesses={businesses.some(
          (b) => getIndustryWorkspaceType(b.category) !== 'gym',
        )}
        onSelectBusiness={handleSelectBusiness}
        onBusinessUpdated={handleBusinessUpdated}
      />
    );
  }
  if (workspaceType === 'clinic') {
    const clinicOnly = businesses.filter((b) => isClinicCategory(b.category));
    return (
      <ClinicManagerView
        key={currentBusiness.id}
        business={currentBusiness}
        clinicBusinesses={clinicOnly.length > 0 ? clinicOnly : [currentBusiness]}
        hasOtherBusinesses={businesses.some((b) => !isClinicCategory(b.category))}
        onSelectBusiness={handleSelectBusiness}
        onBusinessUpdated={handleBusinessUpdated}
      />
    );
  }

  const isCoreReviewOnlyCategory =
    isLoyaltyCategory(currentBusiness.category) ||
    currentBusiness.category === 'retail' ||
    currentBusiness.category === 'services';

  const isLoyaltyEnabled = Boolean(
    currentBusiness.loyaltyEnabled ??
      isLoyaltyCategory(currentBusiness.category),
  );

  const effectiveDestination: PrimaryDestination = isCoreReviewOnlyCategory
    ? destination === 'loyalty_stars' && isLoyaltyEnabled
      ? 'loyalty_stars'
      : 'ai_reviews'
    : destination === 'loyalty_stars' && !isLoyaltyEnabled
      ? 'ai_reviews'
      : destination;

  const currentStatus = currentBusiness.status ?? 'pending';
  const currentAccountState = currentBusiness.accountState ?? 'active';
  const isBusinessLive =
    currentStatus === 'active' && currentAccountState === 'active';

  const statusPillConfig: Record<
    NonNullable<Business['status']>,
    { label: string; className: string; Icon: typeof CheckCircle2 }
  > = {
    pending: {
      label: 'Awaiting Approval',
      className: 'bg-amber-50 text-amber-800 border-amber-200',
      Icon: Clock,
    },
    active: {
      label: 'Active',
      className: 'bg-emerald-50 text-emerald-700 border-emerald-200',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-50 text-red-800 border-red-200',
      Icon: Ban,
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-slate-100 text-slate-700 border-slate-200',
      Icon: ShieldAlert,
    },
  };

  const currentPill = statusPillConfig[currentStatus];
  const StatusIcon = currentPill.Icon;

  type NavItem = {
    id: PrimaryDestination;
    label: string;
    shortLabel: string;
    Icon: typeof LayoutDashboard;
    badge?: number;
    visible?: boolean;
  };

  const navGroups: Array<{ groupLabel: string; items: NavItem[] }> =
    isCoreReviewOnlyCategory
      ? [
          {
            groupLabel: 'Reputation & Growth',
            items: [
              {
                id: 'ai_reviews',
                label: 'AI Google Reviews',
                shortLabel: 'AI Reviews',
                Icon: Sparkles,
                badge: drafts.length > 0 ? drafts.length : undefined,
                visible: true,
              },
              {
                id: 'loyalty_stars',
                label: 'Loyalty & Stars',
                shortLabel: 'Loyalty',
                Icon: Star,
                visible: isLoyaltyEnabled,
              },
            ],
          },
        ]
      : [
          {
            groupLabel: 'Operations',
            items: [
              {
                id: 'overview',
                label: 'Live Desk',
                shortLabel: 'Live',
                Icon: LayoutDashboard,
                visible: true,
              },
              {
                id: 'analytics',
                label: 'Analytics',
                shortLabel: 'Stats',
                Icon: TrendingUp,
                visible: true,
              },
              {
                id: 'menu',
                label: 'Digital Menu',
                shortLabel: 'Menu',
                Icon: UtensilsCrossed,
                visible: true,
              },
              {
                id: 'tables',
                label: 'Tables & Rooms',
                shortLabel: 'Tables',
                Icon: QrCode,
                visible: true,
              },
            ],
          },
          {
            groupLabel: 'Growth & Team',
            items: [
              {
                id: 'ai_reviews',
                label: 'AI Reviews',
                shortLabel: 'Reviews',
                Icon: Sparkles,
                badge: drafts.length > 0 ? drafts.length : undefined,
                visible: moduleVisibility.aiReviews,
              },
              {
                id: 'loyalty_stars',
                label: 'Loyalty & Stars',
                shortLabel: 'Loyalty',
                Icon: Star,
                visible: isLoyaltyEnabled,
              },
              {
                id: 'staff',
                label: 'Staff & Waiters',
                shortLabel: 'Staff',
                Icon: Users,
                visible: moduleVisibility.staff,
              },
              {
                id: 'inventory',
                label: 'Stock & Expenses',
                shortLabel: 'Stock',
                Icon: Package,
                visible: moduleVisibility.inventory,
              },
              {
                id: 'games_loyalty',
                label: 'Games & Loyalty',
                shortLabel: 'Games',
                Icon: Gamepad2,
                visible: moduleVisibility.gamesLoyalty,
              },
            ],
          },
          {
            groupLabel: 'System',
            items: [
              {
                id: 'settings',
                label: 'Settings',
                shortLabel: 'Settings',
                Icon: Settings,
                visible: true,
              },
            ],
          },
        ];

  const isRestaurantDestination =
    !isCoreReviewOnlyCategory &&
    effectiveDestination !== 'ai_reviews' &&
    effectiveDestination !== 'loyalty_stars';

  return (
    <div className="flex min-h-[calc(100vh-52px)] w-full flex-col lg:flex-row">
      {/* FULL-BLEED DOCKED LEFT SIDEBAR RAIL (Zero Outer Margin, Flush to Left Edge) */}
      <aside
        aria-label="Hospitality OS Workspace Navigation"
        className="w-full lg:w-[224px] lg:shrink-0 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col justify-between lg:sticky lg:top-[52px] lg:h-[calc(100vh-52px)] lg:overflow-y-auto"
      >
        <div className="p-3 space-y-4">
          {/* Active Property Selector */}
          <div className="space-y-1.5 border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between gap-2 px-1">
              <span className="text-[10.5px] font-bold uppercase tracking-wider text-slate-400">
                Property
              </span>
              <Link
                to="/setup"
                className="inline-flex items-center gap-0.5 text-[11.5px] font-semibold text-[#1E1B4B] hover:underline"
              >
                <Plus className="h-3 w-3" aria-hidden /> New
              </Link>
            </div>

            <div className="flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5">
              <Building2
                className="h-3.5 w-3.5 shrink-0 text-[#1E1B4B]"
                aria-hidden
              />
              <select
                aria-label="Select active property"
                value={currentBusiness.slug}
                onChange={(e) => handleSelectBusiness(e.target.value)}
                className="w-full min-w-0 truncate bg-transparent text-[13px] font-semibold text-[#111827] focus:outline-none cursor-pointer"
              >
                {businesses.map((b) => (
                  <option key={b.id} value={b.slug}>
                    {b.name} ({b.city})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Clean Flat Grouped Navigation */}
          <nav className="flex overflow-x-auto lg:overflow-x-visible lg:flex-col gap-3">
            {navGroups.map((group) => {
              const visibleItems = group.items.filter(
                (i) => i.visible !== false,
              );
              if (visibleItems.length === 0) return null;
              return (
                <div
                  key={group.groupLabel}
                  className="flex lg:flex-col gap-0.5 shrink-0 lg:shrink"
                >
                  <p className="hidden lg:block px-2.5 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {group.groupLabel}
                  </p>
                  {visibleItems.map(
                    ({ id, label, shortLabel, Icon, badge }) => {
                      const isActive = effectiveDestination === id;
                      return (
                        <button
                          key={id}
                          type="button"
                          onClick={() => handleDestinationChange(id)}
                          aria-current={isActive ? 'page' : undefined}
                          className={`flex h-9 shrink-0 lg:shrink lg:w-full items-center justify-between gap-2 rounded-lg px-2.5 text-[13px] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] ${
                            isActive
                              ? 'bg-[#1E1B4B] text-white font-semibold'
                              : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                          }`}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <Icon
                              className={`h-4 w-4 shrink-0 ${
                                isActive ? 'text-[#D2DB76]' : 'text-slate-500'
                              }`}
                              aria-hidden
                            />
                            <span className="hidden sm:inline truncate">
                              {label}
                            </span>
                            <span className="sm:hidden">{shortLabel}</span>
                          </span>
                          {badge !== undefined && (
                            <span
                              className={`shrink-0 rounded-md px-1.5 py-0.5 text-[10.5px] font-bold tabular-nums ${
                                isActive
                                  ? 'bg-[#D2DB76] text-[#1E1B4B]'
                                  : 'bg-slate-100 text-slate-700'
                              }`}
                            >
                              {badge}
                            </span>
                          )}
                        </button>
                      );
                    },
                  )}
                </div>
              );
            })}
          </nav>
        </div>

        {/* Clean Sidebar Property Footer */}
        <div className="hidden lg:block border-t border-slate-100 p-3 space-y-2.5">
          <div className="flex items-center gap-2.5">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#1E1B4B] text-[#D2DB76]">
              <UserCheck className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold text-[#111827]">
                {currentBusiness.name}
              </p>
              <p className="truncate text-[11px] text-slate-500">
                {categoryLabels[currentBusiness.category]} •{' '}
                {currentBusiness.city}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2">
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-[10.5px] font-semibold ${currentPill.className}`}
            >
              <StatusIcon className="h-3 w-3 shrink-0" aria-hidden />
              {currentPill.label}
            </span>
            {isBusinessLive && (
              <Link
                to={
                  isCoreReviewOnlyCategory
                    ? `/r/${currentBusiness.slug}`
                    : `/r/${currentBusiness.slug}/menu`
                }
                target="_blank"
                className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[#1E1B4B] hover:underline"
              >
                {isCoreReviewOnlyCategory ? 'Review Page' : 'Guest Hub'}{' '}
                <ExternalLink className="h-3 w-3" aria-hidden />
              </Link>
            )}
          </div>
        </div>
      </aside>

      {/* MAIN WORKSPACE CANVAS — 100% REMAINING WIDTH, ZERO WASTED MARGINS */}
      <div className="flex-1 min-w-0 bg-[#F8F9FA] px-4 py-4 sm:px-6 sm:py-5 space-y-4">
        {loyaltyToast && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[13px] font-semibold text-emerald-900"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" aria-hidden />
            <span>{loyaltyToast}</span>
          </div>
        )}

        {!isBusinessLive && (
          <div
            role="status"
            className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3"
          >
            <div className="flex items-center gap-2">
              <StatusIcon className="h-4 w-4 text-amber-700" aria-hidden />
              <p className="text-[13px] font-semibold text-amber-950">
                {currentBusiness.status === 'pending'
                  ? 'Preview Mode — Awaiting Platform Approval. You can configure AI Reviews & Settings now.'
                  : 'Public links are currently paused.'}
              </p>
            </div>
          </div>
        )}

        {/* RESTAURANT / HOSPITALITY WORKSPACE SECTIONS */}
        {isRestaurantDestination && (
          <RestaurantManagerView
            key={`restaurant-mgmt-${currentBusiness.id}`}
            business={currentBusiness}
            isBusinessLive={isBusinessLive}
            activeSection={effectiveDestination as RestaurantWorkspaceSection}
            onSectionChange={(sec) => handleDestinationChange(sec)}
            moduleVisibility={moduleVisibility}
            onModuleVisibilityChange={handleUpdateModules}
          />
        )}

        {/* MODULAR LOYALTY & STAR REWARDS TAB (SURFACED ONLY WHEN loyaltyEnabled === true) */}
        {effectiveDestination === 'loyalty_stars' && isLoyaltyEnabled && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-3.5">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-[#111827] flex items-center gap-2">
                  <Star className="h-5 w-5 fill-amber-400 text-amber-500" aria-hidden />
                  Loyalty &amp; Star Rewards
                </h1>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Manage digital star cards, anti-fraud counter codes, pending approvals, and in-store reward redemptions.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleDestinationChange('ai_reviews')}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 text-[12.5px] font-semibold text-[#1E1B4B] hover:bg-slate-50 cursor-pointer"
                >
                  <Sparkles className="h-3.5 w-3.5" aria-hidden />
                  Core AI Reviews
                </button>
                <button
                  type="button"
                  role="switch"
                  aria-checked={isLoyaltyEnabled}
                  disabled={togglingLoyalty}
                  onClick={() => void handleToggleLoyaltyEnabled(false)}
                  className="inline-flex h-9 items-center gap-2 rounded-lg border border-lime-400 bg-lime-100 px-3 text-[12px] font-bold text-slate-900 hover:bg-lime-200/80 cursor-pointer disabled:opacity-50"
                >
                  <span>Loyalty &amp; Stars: ON</span>
                </button>
              </div>
            </div>

            <LoyaltyManagerView
              key={`loyalty-embedded-${currentBusiness.id}`}
              business={currentBusiness}
              loyaltyBusinesses={businesses}
              hasOtherBusinesses={false}
              embedded
              onSelectBusiness={handleSelectBusiness}
              onBusinessUpdated={handleBusinessUpdated}
            />
          </div>
        )}

        {/* CORE AI GOOGLE REVIEW DASHBOARD (PRIMARY CENTERPIECE!) */}
        {effectiveDestination === 'ai_reviews' && (
          <div className="space-y-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b border-slate-200 pb-4">
              <div>
                <h1 className="text-[22px] font-bold tracking-tight text-[#111827]">
                  AI Google Reviews
                </h1>
                <p className="mt-0.5 text-[13px] text-slate-500">
                  Manage customer review drafts, printable Google Review QR standees, funnel stats, and AI reply voice.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {/* Sleek Loyalty & Star Rewards Toggle Switch in Header Strip */}
                <div className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3">
                  <Star
                    className={`h-3.5 w-3.5 ${
                      isLoyaltyEnabled
                        ? 'fill-amber-400 text-amber-500'
                        : 'text-slate-400'
                    }`}
                    aria-hidden
                  />
                  <span className="text-[12px] font-semibold text-slate-700">
                    Loyalty &amp; Star Rewards
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-label="Toggle Loyalty & Star Rewards"
                    aria-checked={isLoyaltyEnabled}
                    disabled={togglingLoyalty}
                    onClick={() =>
                      void handleToggleLoyaltyEnabled(!isLoyaltyEnabled)
                    }
                    className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors cursor-pointer disabled:opacity-50 ${
                      isLoyaltyEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                        isLoyaltyEnabled ? 'translate-x-4.5' : 'translate-x-1'
                      }`}
                    />
                  </button>
                </div>

                {isLoyaltyEnabled && (
                  <button
                    type="button"
                    onClick={() => handleDestinationChange('loyalty_stars')}
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#1E1B4B] px-3.5 text-[12.5px] font-semibold text-[#D2DB76] hover:bg-[#2E2A6E] cursor-pointer"
                  >
                    <Star className="h-3.5 w-3.5 fill-current" aria-hidden />
                    Loyalty &amp; Stars →
                  </button>
                )}

                {isBusinessLive && (
                  <Link
                    to={`/r/${currentBusiness.slug}`}
                    target="_blank"
                    className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3.5 text-[12.5px] font-semibold text-[#1E1B4B] hover:bg-slate-50"
                  >
                    Open Review Page{' '}
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                )}
              </div>
            </div>

            {/* 4 Core AI Review KPI Cards */}
            <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <QrCode className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                  QR &amp; Link Scans
                </p>
                <p className="mt-1 text-[26px] font-bold text-[#111827] tabular-nums">
                  {metrics.qrScans.toLocaleString()}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  Total customer review page visits
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                  Feedback Submitted
                </p>
                <p className="mt-1 text-[26px] font-bold text-[#111827] tabular-nums">
                  {metrics.feedbackSubmissions.toLocaleString()}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  Experience highlights shared
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  AI Drafts Generated
                </p>
                <p className="mt-1 text-[26px] font-bold text-[#111827] tabular-nums">
                  {metrics.aiGenerations.toLocaleString()}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  {drafts.length} saved in 90-day studio
                </p>
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <ExternalLink className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                  Google Review Clicks
                </p>
                <p className="mt-1 text-[26px] font-bold text-[#111827] tabular-nums">
                  {metrics.googleRedirectClicks.toLocaleString()}
                </p>
                <p className="text-[11.5px] text-slate-500">
                  Copied &amp; opened Google Maps
                </p>
              </div>
            </div>

            {/* Clean Underline Sub-Tabs (No Bubbly Pills) */}
            <div className="flex flex-wrap items-center gap-1 border-b border-slate-200">
              {(
                [
                  {
                    id: 'drafts',
                    label: `Customer Drafts (${drafts.length})`,
                    Icon: MessageSquare,
                  },
                  {
                    id: 'qr',
                    label: 'Review QR & WhatsApp',
                    Icon: QrCode,
                  },
                  {
                    id: 'analytics',
                    label: 'Review Funnel',
                    Icon: BarChart3,
                  },
                  {
                    id: 'settings',
                    label: 'AI & Google Links',
                    Icon: Settings,
                  },
                ] as const
              ).map(({ id, label, Icon }) => {
                const active = aiSubTab === id;
                return (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setAiSubTab(id)}
                    className={`inline-flex h-10 items-center gap-2 border-b-2 px-3.5 text-[13px] font-semibold transition-colors cursor-pointer ${
                      active
                        ? 'border-[#1E1B4B] text-[#1E1B4B]'
                        : 'border-transparent text-slate-500 hover:text-slate-900'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5" aria-hidden />
                    <span>{label}</span>
                  </button>
                );
              })}
            </div>

            {aiSubTab === 'drafts' && (
              <CustomerDraftsView
                key={`drafts-mgmt-${currentBusiness.id}`}
                business={currentBusiness}
                drafts={drafts}
                onDraftUpdated={(updatedRecord) => {
                  setDrafts((prev) =>
                    prev.map((item) =>
                      item.id === updatedRecord.id ? updatedRecord : item,
                    ),
                  );
                }}
              />
            )}

            {aiSubTab === 'qr' &&
              (isBusinessLive ? (
                <QRCodeManager
                  key={currentBusiness.id}
                  business={currentBusiness}
                />
              ) : (
                <div className="rounded-xl border border-slate-200 bg-white p-10 text-center space-y-2">
                  <Clock className="mx-auto h-7 w-7 text-amber-600" aria-hidden />
                  <h3 className="text-[16px] font-bold text-[#111827]">
                    Review QR Locked Until Approved
                  </h3>
                  <p className="mx-auto max-w-md text-[13px] text-slate-500">
                    Once your account is active, your downloadable Google Review QR standee and WhatsApp links appear here.
                  </p>
                </div>
              ))}

            {aiSubTab === 'analytics' && (
              <AnalyticsView
                metrics={metrics}
                events={events}
                businessName={currentBusiness.name}
              />
            )}

            {aiSubTab === 'settings' && (
              <div className="space-y-5">
                {/* Modular Loyalty & Star Rewards Settings Switch */}
                <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-slate-200 bg-white p-5">
                  <div className="space-y-1 max-w-xl">
                    <h3 className="text-[15px] font-bold text-[#111827] flex items-center gap-2">
                      <Star
                        className={`h-4 w-4 ${
                          isLoyaltyEnabled
                            ? 'fill-amber-400 text-amber-500'
                            : 'text-slate-400'
                        }`}
                        aria-hidden
                      />
                      Enable Loyalty &amp; Star Rewards
                    </h3>
                    <p className="text-[12.5px] text-slate-500 leading-relaxed">
                      When OFF, customers see a distraction-free single-screen Google Review page. When ON, customers can also claim +1 Loyalty Star and collect rewards in their phone wallet (<code className="font-mono text-[#1E1B4B]">/r/{currentBusiness.slug}/loyalty</code>).
                    </p>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isLoyaltyEnabled}
                    disabled={togglingLoyalty}
                    onClick={() =>
                      void handleToggleLoyaltyEnabled(!isLoyaltyEnabled)
                    }
                    className={`inline-flex h-9 items-center gap-2 rounded-lg border px-3.5 text-[12.5px] font-semibold transition-colors cursor-pointer disabled:opacity-50 ${
                      isLoyaltyEnabled
                        ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    <span>
                      {isLoyaltyEnabled
                        ? 'Loyalty Stars: Enabled ✓'
                        : 'Enable Loyalty Stars'}
                    </span>
                  </button>
                </div>

                <BusinessCategorySettings
                  key={`biz-category-${currentBusiness.id}`}
                  business={currentBusiness}
                  onUpdated={handleBusinessUpdated}
                />
                <AIConfigurationSettings
                  key={`ai-config-${currentBusiness.id}`}
                  business={currentBusiness}
                />
                <BusinessKnowledgeSettings
                  key={`biz-knowledge-${currentBusiness.id}`}
                  business={currentBusiness}
                />
                <GoogleUrlSettings
                  key={`google-url-${currentBusiness.id}`}
                  business={currentBusiness}
                  onUpdated={handleBusinessUpdated}
                />
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
