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
  Database,
} from 'lucide-react';
import type { Business, BusinessMetrics, AnalyticsEvent, CustomerDraftRecord } from '../types/business';
import { businessRepository } from '../services/storage';
import { isSupabaseConfigured } from '../lib/supabase';
import { categoryLabels } from '../services/business/mockBusinesses';
import { AnalyticsView } from '../components/dashboard/AnalyticsView';
import { QRCodeManager } from '../components/dashboard/QRCodeManager';
import { CustomerDraftsView } from '../components/dashboard/CustomerDraftsView';
import { GoogleUrlSettings } from '../components/dashboard/GoogleUrlSettings';

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
      <div className="py-20 text-center">
        <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-indigo-600 border-r-transparent" />
        <p className="mt-3 text-sm text-slate-500">Loading business dashboard...</p>
      </div>
    );
  }

  if (!currentBusiness) {
    return (
      <div className="py-16 text-center">
        <Building2 className="mx-auto h-12 w-12 text-slate-300" />
        <h2 className="mt-3 text-lg font-semibold text-slate-800">No Business Registered</h2>
        <p className="mt-1 text-sm text-slate-500">Register your first local business to start generating reviews.</p>
        <Link
          to="/setup"
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white hover:bg-indigo-700"
        >
          <Plus className="h-4 w-4" /> Register Business
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Architecture & Storage Notice */}
      <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-100/70 px-4 py-2 text-xs text-slate-600">
        <span className="flex items-center gap-1.5 font-medium">
          <Database className="h-3.5 w-3.5 text-indigo-600" />
          {isSupabaseConfigured ? (
            <>
              Connected to Live Supabase PostgreSQL &amp; Edge Functions (Business ID:{' '}
              <code className="font-mono text-indigo-700 font-bold">{currentBusiness.id}</code>)
            </>
          ) : (
            <>
              Local Demo Mode (Business ID:{' '}
              <code className="font-mono text-indigo-700 font-bold">{currentBusiness.id}</code>)
            </>
          )}
        </span>
        <span className="text-[11px] text-emerald-700 font-medium hidden sm:inline">
          {isSupabaseConfigured ? 'RLS + Edge Functions Active' : 'Local Storage'}
        </span>
      </div>

      {/* Top Header & Tenant Switcher */}
      <div className="flex flex-col gap-4 border-b border-slate-200 pb-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-700 uppercase tracking-wide">
              {categoryLabels[currentBusiness.category]}
            </span>
            <span className="text-xs text-slate-500 font-medium">· {currentBusiness.city}</span>
            {currentBusiness.googleReviewUrlIsPlaceholder && (
              <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
                Preview / Testing URL
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">
            {currentBusiness.name}
          </h1>
          <div className="flex items-center gap-2 pt-0.5">
            <span className="text-xs text-slate-500">Customer Review URL:</span>
            <Link
              to={`/r/${currentBusiness.slug}`}
              target="_blank"
              className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 underline"
            >
              /r/{currentBusiness.slug} <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* Multi-tenant Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 shadow-sm">
            <Building2 className="h-4 w-4 text-slate-500" />
            <select
              aria-label="Select active business"
              value={currentBusiness.slug}
              onChange={(e) => handleSelectBusiness(e.target.value)}
              className="bg-transparent text-sm font-medium text-slate-800 focus:outline-none cursor-pointer"
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
            className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-medium text-white shadow-sm hover:bg-indigo-700"
          >
            <Plus className="h-4 w-4" /> Add Business
          </Link>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex overflow-x-auto border-b border-slate-200 text-sm font-medium">
        <button
          type="button"
          onClick={() => handleTabChange('analytics')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'analytics'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <BarChart3 className="h-4 w-4" /> Event Tracking & Metrics
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('qr')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'qr'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <QrCode className="h-4 w-4" /> QR Code & WhatsApp
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('drafts')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'drafts'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <MessageSquare className="h-4 w-4" /> Review Drafts ({drafts.length})
        </button>
        <button
          type="button"
          onClick={() => handleTabChange('settings')}
          className={`flex items-center gap-2 border-b-2 px-4 py-3 whitespace-nowrap transition-colors ${
            activeTab === 'settings'
              ? 'border-indigo-600 text-indigo-600 font-semibold'
              : 'border-transparent text-slate-600 hover:text-slate-900'
          }`}
        >
          <Settings className="h-4 w-4" /> Google Review Settings
        </button>
      </div>

      {/* Tab Panels */}
      <div>
        {activeTab === 'analytics' && (
          <AnalyticsView
            metrics={metrics}
            events={events}
            businessName={currentBusiness.name}
          />
        )}
        {activeTab === 'qr' && <QRCodeManager business={currentBusiness} />}
        {activeTab === 'drafts' && (
          <CustomerDraftsView drafts={drafts} businessName={currentBusiness.name} />
        )}
        {activeTab === 'settings' && (
          <GoogleUrlSettings business={currentBusiness} onUpdated={handleBusinessUpdated} />
        )}
      </div>
    </div>
  );
}
