import { useState } from 'react';
import { Mic, PenLine, Copy, Check, ArrowRight, MessageSquareQuote } from 'lucide-react';
import type { CustomerDraftRecord } from '../../types/business';
import { copyText } from '../../utils/clipboard';

interface Props {
  drafts: CustomerDraftRecord[];
  businessName: string;
}

export function CustomerDraftsView({ drafts, businessName }: Props) {
  const [filter, setFilter] = useState<'all' | 'voice' | 'text'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const filtered = drafts.filter((d) => {
    if (filter === 'all') return true;
    return d.mode === filter;
  });

  async function handleCopy(id: string, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-bold text-slate-900">Customer Review Drafts</h3>
          <p className="text-xs text-slate-500">
            Experiences captured and drafts generated for {businessName}
          </p>
        </div>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-1 text-xs">
          <button
            type="button"
            onClick={() => setFilter('all')}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              filter === 'all' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            All ({drafts.length})
          </button>
          <button
            type="button"
            onClick={() => setFilter('voice')}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              filter === 'voice' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Voice only
          </button>
          <button
            type="button"
            onClick={() => setFilter('text')}
            className={`rounded-md px-3 py-1 font-medium transition-colors ${
              filter === 'text' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Text only
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-500">
          No customer review drafts recorded yet.
        </div>
      ) : (
        <div className="space-y-4">
          {filtered.map((d) => (
            <div
              key={d.id}
              className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:border-slate-300 space-y-3"
            >
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span
                    className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-medium ${
                      d.mode === 'voice' ? 'bg-purple-50 text-purple-700' : 'bg-blue-50 text-blue-700'
                    }`}
                  >
                    {d.mode === 'voice' ? <Mic className="h-3 w-3" /> : <PenLine className="h-3 w-3" />}
                    {d.mode === 'voice' ? 'Voice Input' : 'Typed Input'}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 font-medium ${
                      d.sentiment === 'positive'
                        ? 'bg-emerald-50 text-emerald-700'
                        : d.sentiment === 'mixed'
                        ? 'bg-amber-50 text-amber-700'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {d.sentiment === 'positive'
                      ? 'Positive Praise'
                      : d.sentiment === 'mixed'
                      ? 'Constructive / Mixed'
                      : 'Neutral'}
                  </span>
                </div>
                <span className="text-slate-400 font-mono text-[11px]">
                  {new Date(d.timestamp).toLocaleString([], {
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </span>
              </div>

              {/* Side-by-side or stacked: Customer Original Words vs Generated Draft */}
              <div className="grid gap-3 md:grid-cols-2">
                <div className="rounded-lg bg-slate-50 p-3 text-xs space-y-1">
                  <p className="font-semibold text-slate-500 uppercase tracking-wider text-[10px] flex items-center gap-1">
                    <MessageSquareQuote className="h-3 w-3" /> Customer's Actual Experience
                  </p>
                  <p className="text-slate-700 italic leading-relaxed">"{d.originalInput}"</p>
                </div>

                <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <p className="font-semibold text-indigo-900 uppercase tracking-wider text-[10px] flex items-center gap-1">
                      <ArrowRight className="h-3 w-3 text-indigo-600" /> AI Assisted Review Draft
                    </p>
                    <button
                      type="button"
                      onClick={() => handleCopy(d.id, d.generatedReview)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-indigo-700 hover:text-indigo-900"
                    >
                      {copiedId === d.id ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
                      {copiedId === d.id ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <p className="text-slate-800 leading-relaxed font-normal">{d.generatedReview}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
