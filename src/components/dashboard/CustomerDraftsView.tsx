import { useState } from 'react';
import {
  Mic,
  PenLine,
  Copy,
  Check,
  ArrowRight,
  MessageSquareQuote,
  Sparkles,
  RotateCcw,
  CheckCircle2,
  CheckCheck,
  Search,
  Info,
  Sliders,
  ChevronDown,
  ChevronUp,
  Save,
} from 'lucide-react';
import {
  CUSTOMER_DRAFT_RETENTION_DAYS,
  type Business,
  type CustomerDraftRecord,
  type ResponseWorkflowStatus,
  type ReviewSentiment,
} from '../../types/business';
import { businessRepository } from '../../services/storage';
import { aiProvider } from '../../services/ai';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';
import { Alert } from '../common/Alert';

interface Props {
  business: Business;
  drafts: CustomerDraftRecord[];
  onDraftUpdated?: (updated: CustomerDraftRecord) => void;
}

type SentimentFilter = 'all' | ReviewSentiment;
type WorkflowFilter =
  | 'all'
  | 'response_pending'
  | 'response_completed'
  | ResponseWorkflowStatus;

const SENTIMENT_BADGE: Record<
  ReviewSentiment,
  { label: string; className: string }
> = {
  positive: {
    label: 'Positive (Est.)',
    className: 'bg-[#EEF3EC] text-[#244B40] border-[#A8BFA5]',
  },
  neutral: {
    label: 'Neutral (Est.)',
    className: 'bg-[#F7F7F2] text-[#252B29] border-[#DDE4DC]',
  },
  negative: {
    label: 'Negative (Est.)',
    className: 'bg-red-50 text-red-900 border-red-300',
  },
  mixed: {
    label: 'Mixed (Est.)',
    className: 'bg-[#FAF3DF] text-[#252B29] border-[#E4BD63]',
  },
};

const WORKFLOW_STATUS_BADGE: Record<
  ResponseWorkflowStatus,
  { label: string; className: string }
> = {
  pending: {
    label: '1. Pending',
    className: 'bg-[#F7F7F2] text-[#252B29] border-[#DDE4DC]',
  },
  draft_generated: {
    label: '2. Draft Generated',
    className: 'bg-[#EEF3EC] text-[#244B40] border-[#A8BFA5]',
  },
  approved: {
    label: '3. Approved',
    className: 'bg-[#FAF3DF] text-[#252B29] border-[#E4BD63]',
  },
  completed: {
    label: '4. Completed',
    className: 'bg-[#244B40] text-[#FFFFFF] border-[#244B40]',
  },
};

export function CustomerDraftsView({
  business,
  drafts,
  onDraftUpdated,
}: Props) {
  const [sentimentFilter, setSentimentFilter] =
    useState<SentimentFilter>('all');
  const [workflowFilter, setWorkflowFilter] = useState<WorkflowFilter>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const [copiedCustomerReviewId, setCopiedCustomerReviewId] = useState<
    string | null
  >(null);
  const [copiedOwnerReplyId, setCopiedOwnerReplyId] = useState<string | null>(
    null,
  );

  // Per-record editing & generation state
  const [editingDraftById, setEditingDraftById] = useState<
    Record<string, string>
  >({});
  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [errorById, setErrorById] = useState<Record<string, string>>({});
  const [matchedContextById, setMatchedContextById] = useState<
    Record<string, string>
  >({});

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const filteredDrafts = drafts.filter((d) => {
    const status: ResponseWorkflowStatus = d.responseStatus ?? 'pending';

    if (sentimentFilter !== 'all' && d.sentiment !== sentimentFilter) {
      return false;
    }

    if (workflowFilter === 'response_pending' && status === 'completed') {
      return false;
    }
    if (workflowFilter === 'response_completed' && status !== 'completed') {
      return false;
    }
    if (
      workflowFilter !== 'all' &&
      workflowFilter !== 'response_pending' &&
      workflowFilter !== 'response_completed' &&
      status !== workflowFilter
    ) {
      return false;
    }

    if (normalizedQuery) {
      const haystack = [
        d.originalInput,
        d.generatedReview,
        d.ownerResponseDraft ?? '',
        d.sentiment,
        status,
      ]
        .join(' ')
        .toLowerCase();
      if (!haystack.includes(normalizedQuery)) {
        return false;
      }
    }

    return true;
  });

  function getDisplayedReplyText(record: CustomerDraftRecord): string {
    if (editingDraftById[record.id] !== undefined) {
      return editingDraftById[record.id];
    }
    return record.ownerResponseDraft ?? '';
  }

  async function handleCopyCustomerReview(id: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopiedCustomerReviewId(id);
      setTimeout(() => setCopiedCustomerReviewId(null), 2000);
    }
  }

  async function handleCopyOwnerResponse(record: CustomerDraftRecord) {
    const text = getDisplayedReplyText(record).trim();
    if (!text) return;
    const ok = await copyText(text);
    if (ok) {
      // Important: Copying a response never automatically marks it 'approved' or 'completed'.
      setCopiedOwnerReplyId(record.id);
      setTimeout(() => setCopiedOwnerReplyId(null), 2000);
    }
  }

  async function handleGenerateOrRegenerate(
    record: CustomerDraftRecord,
    isRegenerate: boolean,
  ) {
    setErrorById((prev) => ({ ...prev, [record.id]: '' }));
    setGeneratingId(record.id);

    const nextAttempt = isRegenerate
      ? (record.responseAttempt ?? 0) + 1
      : 0;

    try {
      const [aiConfig, businessKnowledge] = await Promise.all([
        businessRepository.getBusinessAIConfig(business.id),
        businessRepository.getBusinessKnowledge(business.id),
      ]);

      const generated = await aiProvider.generateBusinessResponse({
        business,
        customerReviewText: record.originalInput,
        sentiment: record.sentiment,
        attempt: nextAttempt,
        aiConfig,
        businessKnowledge,
      });

      const updated = await businessRepository.updateDraftResponse(
        business.id,
        record.id,
        {
          responseDraft: generated.text,
          status: 'draft_generated',
          attempt: nextAttempt,
        },
      );

      setEditingDraftById((prev) => ({
        ...prev,
        [record.id]: updated.ownerResponseDraft ?? generated.text,
      }));

      const matchedItems = [
        ...(generated.selectedKnowledge?.matchedProducts.map((p) => p.name) ??
          []),
        ...(generated.selectedKnowledge?.matchedServices.map((s) => s.name) ??
          []),
        ...(generated.selectedKnowledge?.matchedServiceAreas ?? []),
      ];

      setMatchedContextById((prev) => ({
        ...prev,
        [record.id]:
          matchedItems.length > 0
            ? `Tone: ${generated.appliedConfig.tone} · Length: ${generated.appliedConfig.responseLength} · Lang: ${generated.appliedConfig.language.toUpperCase()} · Matched Knowledge: ${matchedItems.join(', ')}`
            : `Tone: ${generated.appliedConfig.tone} · Length: ${generated.appliedConfig.responseLength} · Lang: ${generated.appliedConfig.language.toUpperCase()}`,
      }));

      onDraftUpdated?.(updated);
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [record.id]:
          (err as Error).message ||
          'Failed to generate business response draft.',
      }));
    } finally {
      setGeneratingId(null);
    }
  }

  async function handleUpdateWorkflowStatus(
    record: CustomerDraftRecord,
    targetStatus: ResponseWorkflowStatus,
  ) {
    setErrorById((prev) => ({ ...prev, [record.id]: '' }));
    const draftText = getDisplayedReplyText(record).trim();

    if (!draftText) {
      setErrorById((prev) => ({
        ...prev,
        [record.id]:
          'Please generate or enter a business response draft first.',
      }));
      return;
    }

    setSavingId(record.id);
    try {
      const updated = await businessRepository.updateDraftResponse(
        business.id,
        record.id,
        {
          responseDraft: draftText,
          status: targetStatus,
          attempt: record.responseAttempt ?? 0,
        },
      );
      setEditingDraftById((prev) => ({
        ...prev,
        [record.id]: updated.ownerResponseDraft ?? draftText,
      }));
      onDraftUpdated?.(updated);
    } catch (err) {
      setErrorById((prev) => ({
        ...prev,
        [record.id]:
          (err as Error).message || 'Unable to update response workflow status.',
      }));
    } finally {
      setSavingId(null);
    }
  }

  const countBySentiment = {
    all: drafts.length,
    positive: drafts.filter((d) => d.sentiment === 'positive').length,
    neutral: drafts.filter((d) => d.sentiment === 'neutral').length,
    negative: drafts.filter((d) => d.sentiment === 'negative').length,
    mixed: drafts.filter((d) => d.sentiment === 'mixed').length,
  };

  const countPending = drafts.filter(
    (d) => (d.responseStatus ?? 'pending') !== 'completed',
  ).length;
  const countCompleted = drafts.filter(
    (d) => (d.responseStatus ?? 'pending') === 'completed',
  ).length;

  return (
    <div className="space-y-5">
      {/* Header & Estimated Sentiment / Retention Notice */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold text-[#252B29] text-[18px] sm:text-[20px]">
            Review Management &amp; Owner Response Drafts
          </h3>
          <p className="text-[13px] text-[#626B65]">
            Review customer feedback, inspect AI-generated review drafts, and prepare owner responses for{' '}
            <strong className="text-[#252B29]">{business.name}</strong> (Business ID:{' '}
            <code className="font-mono">{business.id}</code>).
          </p>
        </div>
        <span className="rounded-lg bg-[#FFFFFF] px-3 py-1 text-[12px] font-medium text-[#252B29] border border-[#DDE4DC]">
          Retention Policy: {CUSTOMER_DRAFT_RETENTION_DAYS} Days
        </span>
      </div>

      <div className="flex items-start gap-2.5 rounded-xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 text-[13px] text-[#626B65]">
        <Info className="h-4 w-4 text-[#244B40] shrink-0 mt-0.5" aria-hidden />
        <div className="space-y-1">
          <p className="font-semibold text-[#252B29]">
            Estimated Sentiment &amp; Non-Gating Policy
          </p>
          <p className="leading-relaxed">
            Sentiment badges (<code>Positive</code>, <code>Neutral</code>,{' '}
            <code>Negative</code>, <code>Mixed</code>) are automated text estimates, not verified customer star ratings. Negative and mixed feedback is never hidden or gated. Marking a response as <strong>Completed</strong> records your internal workflow state and does not claim automatic publication on Google.
          </p>
        </div>
      </div>

      {/* Search & Filters Bar */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-4 shadow-2xs space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {/* Search input */}
          <div className="relative md:col-span-2">
            <Search className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-[#626B65]" aria-hidden />
            <input
              type="search"
              aria-label="Search customer feedback and drafts"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search customer feedback, AI review drafts, or owner responses..."
              className="min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] pl-9 pr-3 py-2 text-[14px] text-[#252B29] placeholder:text-[#626B65] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
            />
          </div>

          {/* Workflow Status Filter */}
          <div>
            <select
              aria-label="Filter by response workflow status"
              value={workflowFilter}
              onChange={(e) =>
                setWorkflowFilter(e.target.value as WorkflowFilter)
              }
              className="min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-2 text-[14px] font-medium text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
            >
              <option value="all">All Workflow Statuses ({drafts.length})</option>
              <option value="response_pending">
                Response Draft Pending ({countPending})
              </option>
              <option value="response_completed">
                Response Draft Completed ({countCompleted})
              </option>
              <option value="pending">1. Pending Only</option>
              <option value="draft_generated">2. Draft Generated Only</option>
              <option value="approved">3. Approved Only</option>
              <option value="completed">4. Completed Only</option>
            </select>
          </div>
        </div>

        {/* Sentiment Filter Pills */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 text-[13px]">
          <span className="text-[12px] font-semibold text-[#626B65] mr-1">
            Estimated Sentiment:
          </span>
          {(
            [
              ['all', `All Feedback (${countBySentiment.all})`],
              ['positive', `Positive (${countBySentiment.positive})`],
              ['neutral', `Neutral (${countBySentiment.neutral})`],
              ['negative', `Negative (${countBySentiment.negative})`],
              ['mixed', `Mixed (${countBySentiment.mixed})`],
            ] as const
          ).map(([key, label]) => (
            <button
              key={key}
              type="button"
              onClick={() => setSentimentFilter(key)}
              aria-pressed={sentimentFilter === key}
              className={`rounded-lg px-3 py-1.5 font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                sentimentFilter === key
                  ? 'bg-[#244B40] text-[#FFFFFF]'
                  : 'bg-[#F7F7F2] text-[#252B29] border border-[#DDE4DC] hover:bg-[#EEF3EC]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Records List */}
      {filteredDrafts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#87928A] bg-[#FFFFFF] p-8 text-center text-[15px] text-[#626B65]">
          No customer feedback records match the selected filters.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredDrafts.map((d) => {
            const status: ResponseWorkflowStatus =
              d.responseStatus ?? 'pending';
            const sentimentBadge =
              SENTIMENT_BADGE[d.sentiment] ?? SENTIMENT_BADGE.neutral;
            const statusBadge = WORKFLOW_STATUS_BADGE[status];
            const replyText = getDisplayedReplyText(d);
            const hasReplyDraft = replyText.trim().length > 0;
            const isExpanded = expandedId === d.id;
            const rowError = errorById[d.id];
            const matchedInfo = matchedContextById[d.id];

            return (
              <div
                key={d.id}
                className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs transition-all hover:border-[#87928A] space-y-4"
              >
                {/* Top Metadata Bar */}
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#DDE4DC] pb-3 text-[13px]">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-md border border-[#DDE4DC] bg-[#F7F7F2] px-2.5 py-0.5 font-medium text-[#252B29]">
                      {d.mode === 'voice' ? (
                        <Mic className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                      ) : (
                        <PenLine className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                      )}
                      {d.mode === 'voice' ? 'Voice Input' : 'Typed Input'}
                    </span>

                    <span
                      className={`rounded-md border px-2.5 py-0.5 font-medium ${sentimentBadge.className}`}
                    >
                      {sentimentBadge.label}
                    </span>

                    <span
                      className={`rounded-md border px-2.5 py-0.5 font-semibold ${statusBadge.className}`}
                    >
                      {statusBadge.label}
                    </span>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-[#626B65] font-mono text-[12px]">
                      {new Date(d.timestamp).toLocaleString([], {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedId(isExpanded ? null : d.id)
                      }
                      className="inline-flex items-center gap-1 text-[12px] font-medium text-[#244B40] hover:underline cursor-pointer"
                    >
                      {isExpanded ? (
                        <>
                          Hide Details <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                        </>
                      ) : (
                        <>
                          Details <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Customer Original Feedback vs AI-Generated Customer Review Draft */}
                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-3.5 text-[14px] space-y-1">
                    <p className="font-semibold text-[#626B65] uppercase tracking-wider text-[11px] flex items-center gap-1">
                      <MessageSquareQuote className="h-3.5 w-3.5 text-[#244B40]" aria-hidden /> Customer&apos;s
                      Provided Feedback
                    </p>
                    <p className="text-[#252B29] italic leading-relaxed">
                      &ldquo;{d.originalInput}&rdquo;
                    </p>
                  </div>

                  <div className="rounded-xl border border-[#A8BFA5] bg-[#EEF3EC]/60 p-3.5 text-[14px] space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="font-semibold text-[#244B40] uppercase tracking-wider text-[11px] flex items-center gap-1">
                        <ArrowRight className="h-3.5 w-3.5 text-[#244B40]" aria-hidden /> AI-Generated
                        Customer Review Draft
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          void handleCopyCustomerReview(d.id, d.generatedReview)
                        }
                        className="inline-flex items-center gap-1 text-[12px] font-medium text-[#244B40] hover:underline cursor-pointer"
                      >
                        {copiedCustomerReviewId === d.id ? (
                          <Check className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {copiedCustomerReviewId === d.id ? 'Copied' : 'Copy'}
                      </button>
                    </div>
                    <p className="text-[#252B29] leading-relaxed font-normal">
                      {d.generatedReview}
                    </p>
                  </div>
                </div>

                {/* Expandable Record Details */}
                {isExpanded && (
                  <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-3 text-[12px] text-[#626B65] grid grid-cols-1 gap-2 sm:grid-cols-3 font-mono">
                    <div>
                      <span className="text-[#626B65]">Record ID:</span>{' '}
                      <span className="text-[#252B29] font-semibold">{d.id}</span>
                    </div>
                    <div>
                      <span className="text-[#626B65]">Business ID:</span>{' '}
                      <span className="text-[#252B29] font-semibold">
                        {d.businessId}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#626B65]">Generation Attempts:</span>{' '}
                      <span className="text-[#252B29] font-semibold">
                        {d.responseAttempt ?? 0}
                      </span>
                    </div>
                    {d.responseGeneratedAt && (
                      <div>
                        <span className="text-[#626B65]">Draft Generated:</span>{' '}
                        {new Date(d.responseGeneratedAt).toLocaleString()}
                      </div>
                    )}
                    {d.responseApprovedAt && (
                      <div>
                        <span className="text-[#626B65]">Approved At:</span>{' '}
                        {new Date(d.responseApprovedAt).toLocaleString()}
                      </div>
                    )}
                    {d.responseCompletedAt && (
                      <div>
                        <span className="text-[#626B65]">Completed At:</span>{' '}
                        {new Date(d.responseCompletedAt).toLocaleString()}
                      </div>
                    )}
                  </div>
                )}

                {rowError && (
                  <Alert tone="error">
                    <p>{rowError}</p>
                  </Alert>
                )}

                {/* Business-Owner AI Response Section */}
                <div className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap items-center gap-1.5 text-[13px] font-semibold text-[#252B29]">
                      <Sliders className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                      Business-Owner Response Draft
                      {matchedInfo && (
                        <span className="ml-2 rounded bg-[#FFFFFF] px-2 py-0.5 font-normal text-[12px] text-[#626B65] border border-[#DDE4DC]">
                          {matchedInfo}
                        </span>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        loading={generatingId === d.id}
                        onClick={() =>
                          void handleGenerateOrRegenerate(d, hasReplyDraft)
                        }
                      >
                        {hasReplyDraft ? (
                          <>
                            <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                            Regenerate Draft
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                            Generate AI Response
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  <textarea
                    rows={3}
                    aria-label={`Business owner response draft for ${d.id}`}
                    value={replyText}
                    onChange={(e) =>
                      setEditingDraftById((prev) => ({
                        ...prev,
                        [d.id]: e.target.value,
                      }))
                    }
                    placeholder="Click 'Generate AI Response' to create a reply using your Phase 3 AI Tone & Phase 4 Business Knowledge, or type/edit your response here..."
                    className="w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2.5 text-[14px] text-[#252B29] placeholder:text-[#626B65] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
                  />

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="ghost"
                        disabled={!hasReplyDraft || savingId === d.id}
                        onClick={() => void handleCopyOwnerResponse(d)}
                      >
                        {copiedOwnerReplyId === d.id ? (
                          <Check className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                        ) : (
                          <Copy className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {copiedOwnerReplyId === d.id
                          ? 'Copied Response'
                          : 'Copy Response'}
                      </Button>

                      <Button
                        type="button"
                        variant="secondary"
                        disabled={!hasReplyDraft || savingId === d.id}
                        onClick={() =>
                          void handleUpdateWorkflowStatus(d, 'draft_generated')
                        }
                      >
                        <Save className="h-3.5 w-3.5" aria-hidden />
                        Save Edited Draft
                      </Button>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <Button
                        type="button"
                        variant="secondary"
                        disabled={
                          !hasReplyDraft ||
                          savingId === d.id ||
                          status === 'approved'
                        }
                        onClick={() =>
                          void handleUpdateWorkflowStatus(d, 'approved')
                        }
                      >
                        <CheckCircle2 className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                        {status === 'approved' ? 'Approved' : 'Approve Response'}
                      </Button>

                      <Button
                        type="button"
                        variant="primary"
                        disabled={
                          !hasReplyDraft ||
                          status === 'pending' ||
                          savingId === d.id ||
                          status === 'completed'
                        }
                        onClick={() =>
                          void handleUpdateWorkflowStatus(d, 'completed')
                        }
                      >
                        <CheckCheck className="h-3.5 w-3.5" aria-hidden />
                        {status === 'completed'
                          ? 'Response Completed'
                          : 'Mark External Response Completed'}
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
