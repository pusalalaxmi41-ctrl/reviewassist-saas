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
      color: 'text-[#244B40] bg-[#EEF3EC] border-[#A8BFA5]',
    },
    {
      id: 'feedback_submitted',
      label: 'Feedback Submissions',
      value: metrics.feedbackSubmissions,
      description: 'Customer completed typing or voice input and continued',
      icon: PenTool,
      color: 'text-[#244B40] bg-[#EEF3EC] border-[#A8BFA5]',
    },
    {
      id: 'ai_generation',
      label: 'AI Generations',
      value: metrics.aiGenerations,
      description: 'Review drafts synthesized from customer words',
      icon: Sparkles,
      color: 'text-[#252B29] bg-[#FAF3DF] border-[#E4BD63]',
    },
    {
      id: 'google_redirect_click',
      label: 'Google Redirect Clicks',
      value: metrics.googleRedirectClicks,
      description: 'Customer clicked to copy review and open Google',
      icon: ExternalLink,
      color: 'text-[#244B40] bg-[#EEF3EC] border-[#A8BFA5]',
    },
  ];

  // Conversion rates between steps
  const feedbackRate = metrics.qrScans > 0 ? Math.round((metrics.feedbackSubmissions / metrics.qrScans) * 100) : 0;
  const redirectRate = metrics.feedbackSubmissions > 0 ? Math.round((metrics.googleRedirectClicks / metrics.feedbackSubmissions) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Critical Verification Notice Banner */}
      <div className="rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC] p-4 text-[#252B29] flex gap-3 text-[14px]">
        <Info className="h-5 w-5 shrink-0 text-[#244B40] mt-0.5" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold text-[#252B29]">
            Analytics &amp; Verification Boundary Notice
          </p>
          <p className="text-[13px] text-[#626B65] leading-relaxed">
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
              className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
                  {card.label}
                </span>
                <span className={`flex h-9 w-9 items-center justify-center rounded-xl border ${card.color}`}>
                  <Icon className="h-4 w-4" aria-hidden />
                </span>
              </div>
              <div className="text-[30px] font-bold text-[#252B29]">{card.value}</div>
              <p className="text-[13px] text-[#626B65] leading-snug">{card.description}</p>
            </div>
          );
        })}
      </div>

      {/* Funnel Overview */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
        <h3 className="text-[18px] font-semibold text-[#252B29]">Conversion Funnel</h3>
        <div className="grid gap-4 md:grid-cols-4 items-center">
          <div className="rounded-xl bg-[#F7F7F2] p-4 border border-[#DDE4DC] text-center">
            <span className="text-[12px] font-semibold uppercase text-[#626B65]">Step 1</span>
            <p className="mt-1 text-[24px] font-bold text-[#252B29]">{metrics.qrScans}</p>
            <p className="text-[13px] text-[#626B65]">Scans / Visits</p>
          </div>

          <div className="rounded-xl bg-[#F7F7F2] p-4 border border-[#DDE4DC] text-center relative">
            <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="h-4 w-4 text-[#626B65]" aria-hidden />
            </div>
            <span className="text-[12px] font-semibold uppercase text-[#626B65]">Step 2 ({feedbackRate}%)</span>
            <p className="mt-1 text-[24px] font-bold text-[#252B29]">{metrics.feedbackSubmissions}</p>
            <p className="text-[13px] text-[#626B65]">Feedback Submissions</p>
          </div>

          <div className="rounded-xl bg-[#F7F7F2] p-4 border border-[#DDE4DC] text-center relative">
            <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="h-4 w-4 text-[#626B65]" aria-hidden />
            </div>
            <span className="text-[12px] font-semibold uppercase text-[#626B65]">Step 3</span>
            <p className="mt-1 text-[24px] font-bold text-[#252B29]">{metrics.aiGenerations}</p>
            <p className="text-[13px] text-[#626B65]">Drafts Generated</p>
          </div>

          <div className="rounded-xl bg-[#EEF3EC] p-4 border border-[#A8BFA5] text-center relative">
            <div className="hidden md:block absolute -left-3 top-1/2 -translate-y-1/2">
              <ArrowRight className="h-4 w-4 text-[#244B40]" aria-hidden />
            </div>
            <span className="text-[12px] font-semibold uppercase text-[#244B40]">Step 4 ({redirectRate}%)</span>
            <p className="mt-1 text-[24px] font-bold text-[#252B29]">{metrics.googleRedirectClicks}</p>
            <p className="text-[13px] text-[#244B40] font-medium">Google Redirects</p>
          </div>
        </div>
      </div>

      {/* Chronological Event Log */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
        <div className="flex items-center justify-between border-b border-[#DDE4DC] pb-3">
          <div>
            <h3 className="text-[18px] font-semibold text-[#252B29] flex items-center gap-2">
              <Activity className="h-4 w-4 text-[#244B40]" aria-hidden /> Tracked Event Stream
            </h3>
            <p className="text-[13px] text-[#626B65]">Raw chronological activity records for {businessName}</p>
          </div>
          <span className="text-[13px] font-mono text-[#626B65]">{events.length} total events recorded</span>
        </div>

        {events.length === 0 ? (
          <p className="text-[14px] text-[#626B65] text-center py-6">No events recorded yet for this business.</p>
        ) : (
          <div className="divide-y divide-[#DDE4DC] max-h-72 overflow-y-auto">
            {events.map((ev) => (
              <div key={ev.id} className="py-2.5 flex items-center justify-between text-[13px]">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`inline-flex px-2 py-0.5 rounded font-mono font-medium border ${
                      ev.eventType === 'ai_generation'
                        ? 'bg-[#FAF3DF] text-[#252B29] border-[#E4BD63]'
                        : 'bg-[#EEF3EC] text-[#244B40] border-[#A8BFA5]'
                    }`}
                  >
                    {ev.eventType}
                  </span>
                  <span className="text-[#252B29]">
                    {ev.eventType === 'qr_scan'
                      ? 'Guest opened review portal'
                      : ev.eventType === 'feedback_submitted'
                      ? 'Experience details provided'
                      : ev.eventType === 'ai_generation'
                      ? 'Review draft created'
                      : 'Review copied & Google review page opened'}
                  </span>
                </div>
                <div className="flex items-center gap-1 text-[#626B65] font-mono">
                  <Clock className="h-3.5 w-3.5" aria-hidden />
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
