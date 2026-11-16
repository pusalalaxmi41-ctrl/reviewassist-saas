import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Building2,
  Plus,
  BarChart3,
  QrCode,
  MessageSquare,
  Settings,
  ExternalLink,
  Clock,
  ShieldAlert,
  Ban,
  CheckCircle2,
} from 'lucide-react';
import type { Business, BusinessMetrics, AnalyticsEvent, CustomerDraftRecord } from '../types/business';
import { businessRepository } from '../services/storage';
import { categoryLabels } from '../services/business/mockBusinesses';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { QRCodeManager } from '../components/dashboard/QRCodeManager';
import { CustomerDraftsView } from '../components/dashboard/CustomerDraftsView';
import { GoogleUrlSettings } from '../components/dashboard/GoogleUrlSettings';
import { AIConfigurationSettings } from '../components/dashboard/AIConfigurationSettings';
import { BusinessKnowledgeSettings } from '../components/dashboard/BusinessKnowledgeSettings';

type Tab = 'analytics' | 'qr' | 'drafts' | 'settings';

export default function BusinessDashboard() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [businesses, setBusinesses] = useState<Business[]>([]);
  const [selectedSlug, setSelectedSlug] = useState<string>(searchParams.get('slug') || 'the-urban-kitchen');
  const [activeTab, setActiveTab] = useState<Tab>((searchParams.get('tab') as Tab) || 'analytics');
  const [loading, setLoading] = useState(true);

  const [metrics, setMetrics] = useState<BusinessMetrics>({
    qrScans: 0,
    feedbackSubmissions: 0,
    aiGenerations: 0,
    googleRedirectClicks: 0,
  });
  const [events, setEvents] = useState<AnalyticsEvent[]>([]);
  const [drafts, setDrafts] = useState<CustomerDraftRecord[]>([]);

  // Load all registered businesses
  useEffect(() => {
    async function loadBusinesses() {
      setLoading(true);
      const list = await businessRepository.getBusinesses();
      setBusinesses(list);

      const paramSlug = searchParams.get('slug');
      if (paramSlug) {
        const match = list.find((b) => b.slug === paramSlug);
        if (match) setSelectedSlug(match.slug);
      } else if (list.length > 0) {
        setSelectedSlug((prev) => (list.some((b) => b.slug === prev) ? prev : list[0].slug));
      }
      setLoading(false);
    }
    void loadBusinesses();
  }, [searchParams]);

  const currentBusiness = businesses.find((b) => b.slug === selectedSlug) ?? businesses[0];

  // Load business-specific metrics, events, and drafts
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
    setSearchParams({ slug: newSlug, tab: activeTab });
  }

  function handleTabChange(tab: Tab) {
    setActiveTab(tab);
    if (currentBusiness) {
      setSearchParams({ slug: currentBusiness.slug, tab });
    }
  }

  function handleBusinessUpdated(updated: Business) {
    setBusinesses((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
  }

  if (loading) {
    return (
      <div className="py-20 text-center" role="status" aria-live="polite">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-[#244B40] border-r-transparent" />
        <p className="mt-3 text-[15px] text-[#626B65]">Loading business dashboard...</p>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] py-16 px-6 text-center shadow-2xs">
        <Building2 className="mx-auto h-12 w-12 text-[#626B65]" aria-hidden />
        <h2 className="mt-3 text-[20px] font-semibold text-[#252B29]">No Business Registered</h2>
        <p className="mt-1 text-[15px] text-[#626B65]">Register your first local business to start generating reviews.</p>
        <Link
          to="/setup"
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#244B40] px-5 py-2.5 text-[14px] font-medium text-[#FFFFFF] hover:bg-[#1C3B32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
        >
          <Plus className="h-4 w-4" aria-hidden /> Register Business
        </Link>
      </div>
    );
  }

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
      className: 'bg-[#FAF3DF] text-[#252B29] border-[#E4BD63]',
      Icon: Clock,
    },
    active: {
      label: 'Active',
      className: 'bg-[#EEF3EC] text-[#244B40] border-[#A8BFA5]',
      Icon: CheckCircle2,
    },
    rejected: {
      label: 'Rejected',
      className: 'bg-red-50 text-red-900 border-red-300',
      Icon: Ban,
    },
    suspended: {
      label: 'Suspended',
      className: 'bg-[#E8EBE7] text-[#252B29] border-[#87928A]',
      Icon: ShieldAlert,
    },
  };

  const currentPill = statusPillConfig[currentStatus];
  const StatusIcon = currentPill.Icon;

  const navItems: {
    id: Tab;
    label: string;
    shortLabel: string;
    Icon: typeof BarChart3;
    badge?: number;
  }[] = [
    {
      id: 'analytics',
      label: 'Overview & Analytics',
      shortLabel: 'Overview',
      Icon: BarChart3,
    },
    {
      id: 'drafts',
      label: 'Review Management',
      shortLabel: 'Reviews',
      Icon: MessageSquare,
      badge: drafts.length,
    },
    {
      id: 'qr',
      label: 'QR Code & WhatsApp',
      shortLabel: 'QR & Share',
      Icon: QrCode,
    },
    {
      id: 'settings',
      label: 'AI, Knowledge & Links',
      shortLabel: 'Settings',
      Icon: Settings,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Top Header & Tenant Switcher */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="space-y-1.5">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md border border-[#DDE4DC] bg-[#F7F7F2] px-2.5 py-0.5 text-[12px] font-semibold text-[#252B29] uppercase tracking-wide">
              {categoryLabels[currentBusiness.category]}
            </span>
            <span className="text-[13px] text-[#626B65] font-medium">· {currentBusiness.city}</span>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${currentPill.className}`}
            >
              <StatusIcon className="h-3.5 w-3.5 shrink-0" aria-hidden />
              {currentPill.label}
            </span>
            {currentBusiness.googleReviewUrlIsPlaceholder && (
              <span className="rounded-full bg-[#FAF3DF] px-2.5 py-0.5 text-[12px] font-medium text-[#252B29] border border-[#E4BD63]">
                Preview / Testing URL
              </span>
            )}
          </div>
          <h1 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[28px]">
            {currentBusiness.name}
          </h1>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-[13px] text-[#626B65]">Customer Review URL:</span>
            {isBusinessLive ? (
              <Link
                to={`/r/${currentBusiness.slug}`}
                target="_blank"
                className="inline-flex items-center gap-1 text-[13px] font-semibold text-[#244B40] hover:underline"
              >
                /r/{currentBusiness.slug} <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </Link>
            ) : (
              <span className="inline-flex items-center gap-1.5 text-[13px] font-mono text-[#626B65]">
                /r/{currentBusiness.slug}{' '}
                <span className="rounded border border-[#DDE4DC] bg-[#F7F7F2] px-2 py-0.5 font-sans text-[11px] font-semibold text-[#626B65]">
                  Offline until approved
                </span>
              </span>
            )}
          </div>
        </div>

        {/* Multi-tenant Switcher */}
        <div className="flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-2.5 sm:gap-3 w-full sm:w-auto">
          <div className="flex min-h-11 items-center gap-2 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-1.5 min-w-0">
            <Building2 className="h-4 w-4 shrink-0 text-[#244B40]" aria-hidden />
            <select
              aria-label="Select active business"
              value={currentBusiness.slug}
              onChange={(e) => handleSelectBusiness(e.target.value)}
              className="w-full min-w-0 truncate bg-transparent text-[14px] font-medium text-[#252B29] focus:outline-none cursor-pointer"
            >
              {businesses.map((b) => (
                <option key={b.id} value={b.slug}>
                  {b.name} ({b.city})
                </option>
              ))}
            </select>
          </div>

          <Link
            to="/setup"
            className="inline-flex min-h-11 items-center gap-1.5 rounded-xl bg-[#244B40] px-4 py-2 text-[14px] font-medium text-[#FFFFFF] hover:bg-[#1C3B32] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden /> Add Business
          </Link>
        </div>
      </div>

      {/* Non-Active Business Gate ("Awaiting Approval" / Rejected / Suspended / Pending Deletion) */}
      {!isBusinessLive && (
        <div
          role="status"
          className="rounded-2xl border border-[#E4BD63] bg-[#FAF3DF] p-5 sm:p-6 shadow-2xs"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#FFFFFF] border border-[#E4BD63] text-[#252B29]">
              {currentBusiness.status === 'pending' ? (
                <Clock className="h-5 w-5 text-[#244B40]" aria-hidden />
              ) : currentBusiness.status === 'rejected' ? (
                <Ban className="h-5 w-5 text-red-700" aria-hidden />
              ) : (
                <ShieldAlert className="h-5 w-5 text-[#252B29]" aria-hidden />
              )}
            </div>
            <div className="space-y-1.5 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-[18px] font-semibold text-[#252B29]">
                  {currentBusiness.accountState === 'pending_deletion'
                    ? 'Account Scheduled for Deletion'
                    : currentBusiness.status === 'pending'
                      ? 'Awaiting Platform Approval'
                      : currentBusiness.status === 'rejected'
                        ? 'Business Registration Not Approved'
                        : 'Business Account Suspended'}
                </h2>
                <span
                  className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[12px] font-medium ${currentPill.className}`}
                >
                  <StatusIcon className="h-3.5 w-3.5" aria-hidden />
                  {currentPill.label}
                </span>
              </div>
              <p className="text-[14px] text-[#252B29] leading-relaxed">
                {currentBusiness.status === 'pending' ? (
                  <>
                    Your business profile has been submitted and is currently awaiting review by the platform owner. Your public QR code and customer review page (
                    <code className="rounded bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[13px]">
                      /r/{currentBusiness.slug}
                    </code>
                    ) are <strong>not live</strong> until approved.
                  </>
                ) : (
                  <>
                    Your public customer review page (
                    <code className="rounded bg-[#FFFFFF] px-1.5 py-0.5 font-mono text-[13px]">
                      /r/{currentBusiness.slug}
                    </code>
                    ) is currently offline and cannot generate customer reviews.
                  </>
                )}
              </p>
              {(currentBusiness.statusReason || currentBusiness.deletedReason) && (
                <p className="mt-2 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] px-3.5 py-2.5 text-[13px] text-[#252B29]">
                  <strong className="font-semibold">Admin Note:</strong>{' '}
                  {currentBusiness.deletedReason || currentBusiness.statusReason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Responsive Dashboard Layout: Sidebar Navigation on Desktop + Horizontal Bar on Mobile */}
      <div className="grid gap-6 lg:grid-cols-12 items-start">
        <aside
          aria-label="Business dashboard sections"
          className="lg:col-span-3 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-2.5 shadow-2xs"
        >
          <nav className="flex overflow-x-auto lg:flex-col gap-1">
            {navItems.map(({ id, label, shortLabel, Icon, badge }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => handleTabChange(id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={`flex min-h-11 items-center justify-between gap-2.5 rounded-xl px-3.5 py-2.5 text-[14px] font-medium whitespace-nowrap transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                    isActive
                      ? 'bg-[#244B40] text-[#FFFFFF] font-semibold'
                      : 'text-[#252B29] hover:bg-[#F7F7F2]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <Icon
                      className={`h-4 w-4 shrink-0 ${
                        isActive ? 'text-[#FFFFFF]' : 'text-[#244B40]'
                      }`}
                      aria-hidden
                    />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{shortLabel}</span>
                  </span>
                  {badge !== undefined && (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[12px] font-semibold ${
                        isActive
                          ? 'bg-[#FFFFFF]/20 text-[#FFFFFF]'
                          : 'bg-[#EEF3EC] text-[#244B40]'
                      }`}
                    >
                      {badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>
        </aside>

        {/* Active Section Content */}
        <div className="lg:col-span-9 min-w-0">
          {activeTab === 'analytics' && (
            <AnalyticsView
              metrics={metrics}
              events={events}
              businessName={currentBusiness.name}
            />
          )}
          {activeTab === 'qr' &&
            (isBusinessLive ? (
              <QRCodeManager key={currentBusiness.id} business={currentBusiness} />
            ) : (
              <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-10 text-center space-y-3">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#FAF3DF] text-[#244B40] border border-[#E4BD63]">
                  <Clock className="h-6 w-6" aria-hidden />
                </div>
                <h3 className="text-[18px] font-semibold text-[#252B29]">
                  QR Code &amp; Review Link Locked Until Approved
                </h3>
                <p className="mx-auto max-w-md text-[14px] text-[#626B65] leading-relaxed">
                  Only active, approved businesses can serve customer review pages. Once the platform administrator approves{' '}
                  <strong className="text-[#252B29]">{currentBusiness.name}</strong>, your downloadable QR code and WhatsApp share links will appear here automatically.
                </p>
              </div>
            ))}
          {activeTab === 'drafts' && (
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
          {activeTab === 'settings' && (
            <div className="space-y-6">
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
      </div>
    </div>
  );
}
