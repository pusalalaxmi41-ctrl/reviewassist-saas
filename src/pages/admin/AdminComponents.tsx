import { useState, type FormEvent } from 'react';
import {
  AlertTriangle,
  Clock,
  RotateCcw,
  Trash2,
  X,
} from 'lucide-react';
import type {
  AccountLifecycleState,
  BusinessStatus,
} from '../../types/business';
import type { DailySignupPoint } from '../../types/admin';

function getDaysRemainingInternal(scheduledIso: string | null): number | null {
  if (!scheduledIso) return null;
  const target = new Date(scheduledIso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - Date.now();
  return Math.max(0, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
}

/**
 * Small rounded status pill following Stripe/Linear design rules:
 * amber = pending, green = active, red = rejected, gray = suspended
 */
export function BusinessStatusBadge({ status }: { status: BusinessStatus }) {
  const styles: Record<
    BusinessStatus,
    { bg: string; text: string; dot: string; label: string }
  > = {
    pending: {
      bg: 'bg-amber-50 border-amber-200/90',
      text: 'text-amber-800',
      dot: 'bg-amber-500',
      label: 'Pending',
    },
    active: {
      bg: 'bg-emerald-50 border-emerald-200/90',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500',
      label: 'Active',
    },
    rejected: {
      bg: 'bg-rose-50 border-rose-200/90',
      text: 'text-rose-700',
      dot: 'bg-rose-500',
      label: 'Rejected',
    },
    suspended: {
      bg: 'bg-slate-100 border-slate-200/90',
      text: 'text-slate-700',
      dot: 'bg-slate-400',
      label: 'Suspended',
    },
  };

  const cfg = styles[status] ?? styles.pending;

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

/**
 * Account lifecycle state badge with countdown for pending_deletion
 */
export function AccountStateBadge({
  state,
  deletionScheduledFor,
  onQuickRestore,
}: {
  state: AccountLifecycleState;
  deletionScheduledFor: string | null;
  onQuickRestore?: () => void;
}) {
  if (state === 'pending_deletion') {
    const daysLeft = getDaysRemainingInternal(deletionScheduledFor);
    return (
      <div className="inline-flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-xs font-medium text-rose-700">
          <Clock className="h-3 w-3 text-rose-600" />
          Pending deletion
          {daysLeft !== null && (
            <span className="rounded bg-rose-100 px-1 py-0.2 text-[10px] font-semibold text-rose-800">
              {daysLeft}d left
            </span>
          )}
        </span>
        {onQuickRestore && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onQuickRestore();
            }}
            className="inline-flex items-center gap-1 rounded-md border border-indigo-200 bg-indigo-50/70 px-2 py-0.5 text-[11px] font-medium text-indigo-700 hover:bg-indigo-100 transition-colors cursor-pointer"
          >
            <RotateCcw className="h-3 w-3" />
            Restore
          </button>
        )}
      </div>
    );
  }

  if (state === 'disabled') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
        Disabled
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200/80 bg-emerald-50/70 px-2.5 py-0.5 text-xs font-medium text-emerald-700">
      <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
      Active
    </span>
  );
}

/**
 * Clean 30-day Signups Over Time SVG Line Chart
 */
export function SignupsTrendChart({ data }: { data: DailySignupPoint[] }) {
  if (!data || data.length === 0) {
    return (
      <div className="flex h-44 items-center justify-center rounded-lg border border-dashed border-slate-200 text-xs text-slate-400">
        No signup history available for the last 30 days
      </div>
    );
  }

  const width = 640;
  const height = 160;
  const padX = 24;
  const padY = 20;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const maxCount = Math.max(4, ...data.map((d) => d.count));
  const total30d = data.reduce((sum, pt) => sum + pt.count, 0);

  const points = data.map((pt, idx) => {
    const x =
      padX +
      (data.length === 1 ? innerW / 2 : (idx / (data.length - 1)) * innerW);
    const y = padY + innerH - (pt.count / maxCount) * innerH;
    return { x, y, ...pt };
  });

  const linePath = points
    .map((p, idx) => `${idx === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaPath = `${linePath} L ${points[points.length - 1].x.toFixed(1)} ${(padY + innerH).toFixed(1)} L ${points[0].x.toFixed(1)} ${(padY + innerH).toFixed(1)} Z`;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between text-xs text-slate-500">
        <span>Last 30 days daily business signups</span>
        <span className="font-medium text-slate-700">
          {total30d} signups in 30d
        </span>
      </div>
      <div className="overflow-hidden rounded-lg border border-slate-100 bg-slate-50/50 p-3">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          className="h-40 w-full overflow-visible"
          role="img"
          aria-label="Signups over the last 30 days"
        >
          <defs>
            <linearGradient id="indigoAreaGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal reference grid lines */}
          {[0, 0.5, 1].map((ratio) => {
            const y = padY + innerH * (1 - ratio);
            const val = Math.round(maxCount * ratio);
            return (
              <g key={ratio}>
                <line
                  x1={padX}
                  y1={y}
                  x2={width - padX}
                  y2={y}
                  stroke="#e2e8f0"
                  strokeDasharray="3 3"
                  strokeWidth="1"
                />
                <text
                  x={4}
                  y={y + 3}
                  className="fill-slate-400 text-[9px] font-mono"
                >
                  {val}
                </text>
              </g>
            );
          })}

          <path d={areaPath} fill="url(#indigoAreaGrad)" />
          <path
            d={linePath}
            fill="none"
            stroke="#4f46e5"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {points.map((p) => (
            <g key={p.date}>
              <circle
                cx={p.x}
                cy={p.y}
                r={p.count > 0 ? 3 : 1.75}
                className={
                  p.count > 0
                    ? 'fill-indigo-600 stroke-white stroke-1'
                    : 'fill-slate-300'
                }
              >
                <title>
                  {p.date}: {p.count} signup{p.count === 1 ? '' : 's'}
                </title>
              </circle>
            </g>
          ))}
        </svg>

        <div className="mt-1 flex justify-between px-2 text-[11px] text-slate-400 font-mono">
          <span>{data[0]?.date}</span>
          <span>{data[Math.floor(data.length / 2)]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      </div>
    </div>
  );
}

/**
 * Modal for actions that require a reason (Reject, Suspend, Disable, or Soft-Delete with grace period)
 */
export function ReasonActionModal({
  title,
  description,
  confirmLabel,
  tone = 'danger',
  showGraceDaysInput = false,
  defaultGraceDays = 14,
  loading = false,
  onConfirm,
  onClose,
}: {
  title: string;
  description: string;
  confirmLabel: string;
  tone?: 'danger' | 'warning' | 'indigo';
  showGraceDaysInput?: boolean;
  defaultGraceDays?: number;
  loading?: boolean;
  onConfirm: (reason: string, graceDays?: number) => void;
  onClose: () => void;
}) {
  const [reason, setReason] = useState('');
  const [graceDays, setGraceDays] = useState(defaultGraceDays);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const trimmed = reason.trim();
    if (!trimmed) {
      setError('A clear reason is required for the audit log.');
      return;
    }
    setError(null);
    onConfirm(trimmed, showGraceDaysInput ? graceDays : undefined);
  }

  const buttonClass =
    tone === 'danger'
      ? 'bg-rose-600 hover:bg-rose-700 text-white'
      : tone === 'warning'
        ? 'bg-amber-600 hover:bg-amber-700 text-white'
        : 'bg-indigo-600 hover:bg-indigo-700 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
              <AlertTriangle className="h-4 w-4" />
            </div>
            <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="mt-2 text-xs text-slate-600 leading-relaxed">
          {description}
        </p>

        <form onSubmit={handleSubmit} className="mt-4 space-y-4">
          {showGraceDaysInput && (
            <div>
              <label
                htmlFor="graceDaysSelect"
                className="block text-xs font-medium text-slate-700 mb-1"
              >
                Grace period before permanent purge (days)
              </label>
              <select
                id="graceDaysSelect"
                value={graceDays}
                onChange={(e) => setGraceDays(Number(e.target.value))}
                className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs text-slate-800 focus:border-indigo-500 focus:outline-none"
              >
                <option value={7}>7 days</option>
                <option value={14}>14 days (Default)</option>
                <option value={30}>30 days</option>
                <option value={60}>60 days</option>
              </select>
            </div>
          )}

          <div>
            <label
              htmlFor="adminReasonInput"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Reason (recorded in immutable audit log)
            </label>
            <textarea
              id="adminReasonInput"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Enter the reason for this action..."
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
              autoFocus
            />
            {error && <p className="mt-1 text-xs text-rose-600">{error}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className={`rounded-lg px-3.5 py-2 text-xs font-medium shadow-2xs transition-colors ${buttonClass} disabled:opacity-50`}
            >
              {loading ? 'Processing...' : confirmLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/**
 * Confirmation dialog for permanent immediate deletion:
 * Requires typing the exact business name and entering a reason.
 */
export function PermanentDeleteModal({
  businessName,
  ownerEmail,
  loading = false,
  onConfirm,
  onClose,
}: {
  businessName: string;
  ownerEmail: string;
  loading?: boolean;
  onConfirm: (typedBusinessName: string, reason: string) => void;
  onClose: () => void;
}) {
  const [typedName, setTypedName] = useState('');
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);

  const isMatch = typedName.trim() === businessName;

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!isMatch) {
      setError(`Please type "${businessName}" exactly to confirm.`);
      return;
    }
    if (!reason.trim()) {
      setError('A deletion reason is required for the audit log.');
      return;
    }
    setError(null);
    onConfirm(typedName.trim(), reason.trim());
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-[1px]"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md rounded-lg border border-rose-200 bg-white p-6 shadow-xl">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
              <Trash2 className="h-4 w-4" />
            </div>
            <div>
              <h3 className="text-base font-semibold text-slate-900">
                Delete Account Permanently Now
              </h3>
              <p className="text-[11px] text-rose-600 font-medium">
                Irreversible server-side operation
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close modal"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-3 rounded-lg border border-rose-100 bg-rose-50/60 p-3 text-xs text-slate-700 space-y-1">
          <p>
            This will immediately delete the business{' '}
            <strong className="font-semibold text-slate-900">
              {businessName}
            </strong>{' '}
            (cascading all analytics events, customer drafts, and rate-limit
            records) and then delete the Supabase Auth user{' '}
            <code className="font-mono text-[11px] text-rose-800">
              {ownerEmail}
            </code>
            .
          </p>
          <p className="text-[11px] text-slate-500">
            A plain-text audit entry with the business name and owner email will
            be preserved in <code className="font-mono">admin_audit_log</code>.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label
              htmlFor="confirmBizNameInput"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Type{' '}
              <span className="rounded bg-slate-100 px-1.5 py-0.5 font-mono font-semibold text-slate-900">
                {businessName}
              </span>{' '}
              to confirm
            </label>
            <input
              id="confirmBizNameInput"
              type="text"
              value={typedName}
              onChange={(e) => setTypedName(e.target.value)}
              placeholder={businessName}
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              autoFocus
            />
          </div>

          <div>
            <label
              htmlFor="permDeleteReasonInput"
              className="block text-xs font-medium text-slate-700 mb-1"
            >
              Reason for permanent deletion
            </label>
            <textarea
              id="permDeleteReasonInput"
              rows={2}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Confirmed fraudulent listing / owner GDPR erasure request"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 text-xs text-slate-900 focus:border-rose-500 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
            />
          </div>

          {error && <p className="text-xs text-rose-600 font-medium">{error}</p>}

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!isMatch || !reason.trim() || loading}
              className="rounded-lg bg-rose-600 px-3.5 py-2 text-xs font-medium text-white shadow-2xs hover:bg-rose-700 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {loading ? 'Deleting permanently...' : 'Delete permanently now'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export function TableLoadingSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="divide-y divide-slate-100">
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="flex items-center justify-between px-5 py-4 animate-pulse"
        >
          <div className="space-y-2">
            <div className="h-3.5 w-44 rounded bg-slate-200" />
            <div className="h-2.5 w-28 rounded bg-slate-100" />
          </div>
          <div className="h-5 w-20 rounded-full bg-slate-100" />
        </div>
      ))}
    </div>
  );
}
