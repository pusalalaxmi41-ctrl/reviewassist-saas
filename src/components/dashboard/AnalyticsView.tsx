import {
  QrCode,
  PenTool,
  Sparkles,
  ExternalLink,
  Info,
  Clock,
  Activity,
  ArrowRight,
} from 'lucide-react';
import type { BusinessMetrics, AnalyticsEvent } from '../../types/business';

interface Props {
  metrics: BusinessMetrics;
  events: AnalyticsEvent[];
  businessName: string;
}

export function AnalyticsView({ metrics, events, businessName }: Props) {
  const statCards = [
    {
      id: 'qr_scan',
      label: 'QR Scans / Visits',
      value: metrics.qrScans,
      description: 'Customer accessed the review portal via QR or link',
      icon: QrCode,
      color: 'text-blue-600 bg-blue-50 border-blue-200',
    },
    {
      id: 'feedback_submitted',
      label: 'Feedback Submissions',
      value: metrics.feedbackSubmissions,
      description: 'Customer completed typing or voice input and continued',
      icon: PenTool,
      color: 'text-indigo-600 bg-indigo-50 border-indigo-200',
    },
    {
      id: 'ai_generation',
      label: 'AI Generations',
      value: metrics.aiGenerations,
      description: 'Review drafts synthesized from customer words',
      icon: Sparkles,
      color: 'text-purple-600 bg-purple-50 border-purple-200',
    },
    {
      id: 'google_redirect_click',
      label: 'Google Redirect Clicks',
      value: metrics.googleRedirectClicks,
      description: 'Customer clicked to copy review and open Google',
      icon: ExternalLink,
      color: 'text-emerald-600 bg-emerald-50 border-emerald-200',
    },
  ];

  // Conversion rates between steps
  const feedbackRate = metrics.qrScans > 0 ? Math.round((metrics.feedbackSubmissions / metrics.qrScans) * 100) : 0;
  const redirectRate = metrics.feedbackSubmissions > 0 ? Math.round((metrics.googleRedirectClicks / metrics.feedbackSubmissions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Critical Verification Notice Banner */}
      <div className="rounded-xl border border-sky-200 bg-sky-50/80 p-4 text-sky-950 flex gap-3 text-sm">
        <Info className="h-5 w-5 shrink-0 text-sky-600 mt-0.5" />
        <div className="space-y-1">
          <p className="font-semibold text-sky-900">
            Analytics & Verification Boundary Notice
          </p>
          <p className="text-xs text-sky-800 leading-relaxed">
            <strong>Google Redirect Clicks</strong> record when a customer copies their AI review draft and opens the Google review page. Because Google does not provide an external API or webhook to verify submissions on Google Maps, actual published reviews cannot be confirmed automatically. This platform tracks customer intent and verified hand-off to Google without claiming false verification.
          </p>
        </div>
      </div>

      {/* 4 Separate Metric Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  {card.label}
                </span>
                <span className={`flex h-8 w-8 items-center justify-center rounded-lg border ${card.color}`}>
                  <Icon className="h-4 w-4" />
                </span>
              </div>
              <div className="text-3xl font-extrabold text-slate-900">{card.value}</div>
              <p className="text-xs text-slate-500 leading-snug">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Funnel Overview */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <h3 className="font-bold text-slate-900">Conversion Funnel</h3>
        <div className="grid gap-4 md:grid-cols-4 items-center">
          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-center">
            <span className="text-xs font-semibold uppercase text-slate-500">Step 1</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.qrScans}</p>
            <p className="text-xs text-slate-600">Scans / Visits</p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-center relative">
            <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </div>
            <span className="text-xs font-semibold uppercase text-slate-500">Step 2 ({feedbackRate}%)</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.feedbackSubmissions}</p>
            <p className="text-xs text-slate-600">Feedback Submissions</p>
          </div>

          <div className="rounded-lg bg-slate-50 p-4 border border-slate-200 text-center relative">
            <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="h-4 w-4 text-slate-400" />
            </div>
            <span className="text-xs font-semibold uppercase text-slate-500">Step 3</span>
            <p className="mt-1 text-2xl font-bold text-slate-900">{metrics.aiGenerations}</p>
            <p className="text-xs text-slate-600">Drafts Generated</p>
          </div>

          <div className="rounded-lg bg-emerald-50/70 p-4 border border-emerald-200 text-center relative">
            <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="h-4 w-4 text-emerald-500" />
            </div>
            <span className="text-xs font-semibold uppercase text-emerald-700">Step 4 ({redirectRate}%)</span>
            <p className="mt-1 text-2xl font-bold text-emerald-900">{metrics.googleRedirectClicks}</p>
            <p className="text-xs text-emerald-700">Google Redirects</p>
          </div>
        </div>
      </div>

      {/* Chronological Event Log */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <Activity className="h-4 w-4 text-indigo-600" /> Tracked Event Stream
            </h3>
            <p className="text-xs text-slate-500">Raw chronological activity records for {businessName}</p>
          </div>
          <span className="text-xs font-mono text-slate-400">{events.length} total events recorded</span>
        </div>

        {events.length === 0 ? (
          <p className="text-sm text-slate-500 text-center py-6">No events recorded yet for this business.</p>
        ) : (
          <div className="divide-y divide-slate-100 max-h-72 overflow-y-auto">
            {events.map((ev) => (
              <div key={ev.id} className="py-2.5 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded font-mono font-medium ${
                      ev.eventType === 'qr_scan'
                        ? 'bg-blue-50 text-blue-700'
                        : ev.eventType === 'feedback_submitted'
                        ? 'bg-indigo-50 text-indigo-700'
                        : ev.eventType === 'ai_generation'
                        ? 'bg-purple-50 text-purple-700'
                        : 'bg-emerald-50 text-emerald-700'
                    }`}
                  >
                    {ev.eventType}
                  </span>
                  <span className="text-slate-700">
                    {ev.eventType === 'qr_scan'
                      ? 'Guest opened review portal'
                      : ev.eventType === 'feedback_submitted'
                      ? 'Experience details provided'
                      : ev.eventType === 'ai_generation'
                      ? 'Review draft created'
                      : 'Review copied & Google review page opened'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-slate-400 font-mono">
                  <Clock className="h-3 w-3" />
                  <span>{new Date(ev.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
