import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Dumbbell,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Clock,
  RefreshCw,
  Copy,
  Check,
  MessageCircle,
  UserPlus,
  Search,
  Flame,
  ExternalLink,
  XCircle,
  Users,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  GymMember,
  GymOwnerDashboardPayload,
  GymOwnerMemberAction,
} from '../../types/gym';
import { businessRepository } from '../../services/storage';
import {
  buildGymRenewalWhatsAppMessage,
  formatIsoDatePretty,
  getGymPortalUrl,
  getGymRenewalWhatsAppLink,
} from '../../utils/gymValidation';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import { copyText } from '../../utils/clipboard';

interface Props {
  business: Business;
  isBusinessLive: boolean;
}

export function GymManagerView({ business, isBusinessLive }: Props) {
  const [dashboard, setDashboard] = useState<GymOwnerDashboardPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [busyMemberId, setBusyMemberId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Filter & Manual Walk-In Registration
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddWalkIn, setShowAddWalkIn] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInPlanId, setWalkInPlanId] = useState('1_month');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  const gymPortalUrl = getGymPortalUrl(business.slug);

  const loadDashboard = useCallback(async () => {
    try {
      const data = await businessRepository.getGymOwnerDashboard(business.id);
      setDashboard(data);
      if (data.config.plans.length > 0) {
        setWalkInPlanId((prev) =>
          data.config.plans.some((p) => p.id === prev)
            ? prev
            : data.config.plans[0].id,
        );
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [business.id]);

  useEffect(() => {
    let active = true;
    const init = window.setTimeout(() => {
      if (active) void loadDashboard();
    }, 0);
    const interval = window.setInterval(() => {
      void loadDashboard();
    }, 15000);
    return () => {
      active = false;
      window.clearTimeout(init);
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  function flashStatus(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => setStatusMessage(null), 5000);
  }

  async function handleMemberAction(
    member: GymMember,
    action: GymOwnerMemberAction,
    overrideDurationDays?: number,
  ) {
    setBusyMemberId(member.id);
    setErrorMessage(null);
    try {
      const updated = await businessRepository.ownerApproveOrRenewGymMember({
        businessId: business.id,
        memberId: member.id,
        action,
        durationDays: overrideDurationDays ?? null,
        staffLabel: 'Owner',
      });
      if (action === 'approve') {
        flashStatus(
          `Approved ${updated.fullName} — ${updated.planName} active until ${formatIsoDatePretty(updated.endDate)}!`,
        );
      } else if (action === 'renew') {
        flashStatus(
          `Renewed ${updated.fullName} (+${overrideDurationDays ?? updated.durationDays} days) — valid until ${formatIsoDatePretty(updated.endDate)}!`,
        );
      } else if (action === 'reject') {
        flashStatus(`Rejected pending signup for ${updated.fullName}.`);
      } else {
        flashStatus(`Suspended membership for ${updated.fullName}.`);
      }
      await loadDashboard();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyMemberId(null);
    }
  }

  async function handleCopyReminder(member: GymMember) {
    const msg = buildGymRenewalWhatsAppMessage(business.name, member);
    const ok = await copyText(msg);
    if (ok) {
      setCopiedId(member.id);
      flashStatus(`Copied WhatsApp renewal reminder for ${member.fullName}!`);
      window.setTimeout(() => setCopiedId(null), 2500);
    }
  }

  async function handleAddWalkInMember(e: React.FormEvent) {
    e.preventDefault();
    setAddingWalkIn(true);
    setErrorMessage(null);
    try {
      const created = await businessRepository.submitGymMemberRegistration({
        businessSlug: business.slug,
        fullName: walkInName,
        phone: walkInPhone,
        planId: walkInPlanId,
      });
      // Immediately approve desk walk-in if added by owner directly
      const active = await businessRepository.ownerApproveOrRenewGymMember({
        businessId: business.id,
        memberId: created.id,
        action: 'approve',
        staffLabel: 'Owner Desk',
      });
      setWalkInName('');
      setWalkInPhone('');
      setShowAddWalkIn(false);
      flashStatus(
        `Registered & activated ${active.fullName} (${active.memberCode}) until ${formatIsoDatePretty(active.endDate)}!`,
      );
      await loadDashboard();
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setAddingWalkIn(false);
    }
  }

  const members = useMemo(() => dashboard?.members ?? [], [dashboard]);
  const pendingApprovals = useMemo(
    () => members.filter((m) => m.effectiveStatus === 'pending_approval'),
    [members],
  );
  const expiringSoon = useMemo(
    () => members.filter((m) => m.effectiveStatus === 'expiring_soon'),
    [members],
  );
  const expiredMembers = useMemo(
    () => members.filter((m) => m.effectiveStatus === 'expired'),
    [members],
  );
  const activeMembers = useMemo(
    () =>
      members.filter(
        (m) =>
          m.effectiveStatus === 'active' ||
          m.effectiveStatus === 'expiring_soon',
      ),
    [members],
  );

  const filteredActiveMembers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeMembers;
    return activeMembers.filter(
      (m) =>
        m.fullName.toLowerCase().includes(q) ||
        m.phone.includes(q) ||
        m.memberCode.toLowerCase().includes(q) ||
        m.planName.toLowerCase().includes(q),
    );
  }, [activeMembers, searchQuery]);

  if (loading) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-12 text-center">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-slate-900 border-r-transparent" />
        <p className="mt-3 text-[14px] font-semibold text-slate-500">
          Loading GymOS Renewal Radar…
        </p>
      </div>
    );
  }

  const alertWindowDays = dashboard?.config.renewalAlertDays ?? 3;

  return (
    <div className="space-y-6 animate-fadeSlideUp">
      {/* Header Row */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-[28px] sm:text-[32px] font-black tracking-tight text-slate-900">
              Renewal Radar &amp; Approvals
            </h1>
            <span className="rounded-full bg-[#0F172A] px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider text-[#A3E635]">
              {alertWindowDays}-Day Alert Active
            </span>
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-3 text-[13px] font-semibold text-slate-500">
            <span>{business.name}</span>
            {isBusinessLive && (
              <a
                href={gymPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-slate-900 hover:underline"
              >
                Front-Desk Member QR Portal{' '}
                <ExternalLink className="h-3.5 w-3.5" aria-hidden />
              </a>
            )}
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAddWalkIn((v) => !v)}
            className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F172A] px-4 text-[13px] font-extrabold text-[#A3E635] hover:bg-slate-800 cursor-pointer"
          >
            <UserPlus className="h-4 w-4" aria-hidden />
            {showAddWalkIn ? 'Close Walk-In' : '+ Add Desk Member'}
          </button>
          <button
            type="button"
            onClick={() => void loadDashboard()}
            aria-label="Refresh gym dashboard"
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-900 hover:bg-slate-50 cursor-pointer"
          >
            <RefreshCw className="h-4 w-4" aria-hidden />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-emerald-800"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{statusMessage}</span>
        </div>
      )}
      {errorMessage && (
        <div
          role="alert"
          className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4 LIVE KPI CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-amber-200 bg-amber-50/70 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-amber-800 flex items-center gap-1">
            <Clock className="h-3.5 w-3.5" aria-hidden /> Pending Cash/UPI
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-black text-slate-900 tabular-nums">
            {pendingApprovals.length}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-amber-900/80">
            Awaiting payment approval
          </p>
        </div>

        <div className="rounded-2xl border border-red-200 bg-red-50/80 p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-red-700 flex items-center gap-1">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden /> Expiring ≤{' '}
            {alertWindowDays}d
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-black text-red-700 tabular-nums">
            {expiringSoon.length}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-red-900/80">
            Urgent renewal reminders
          </p>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-[#0F172A] p-4 text-white">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#A3E635] flex items-center gap-1">
            <Dumbbell className="h-3.5 w-3.5" aria-hidden /> Active Members
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-black text-white tabular-nums">
            {activeMembers.length}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-slate-400">
            {expiredMembers.length} expired tracked separately
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500 flex items-center gap-1">
            <Flame className="h-3.5 w-3.5 text-orange-500" aria-hidden /> Checked-In Today
          </p>
          <p className="mt-1.5 text-[28px] leading-none font-black text-slate-900 tabular-nums">
            {dashboard?.checkedInTodayCount ?? 0}
          </p>
          <p className="mt-1 text-[11.5px] font-semibold text-slate-500">
            Daily digital attendance
          </p>
        </div>
      </div>

      {/* OPTIONAL DESK WALK-IN REGISTRATION DRAWER */}
      {showAddWalkIn && (
        <form
          onSubmit={(e) => void handleAddWalkInMember(e)}
          className="rounded-3xl border border-slate-300 bg-slate-50 p-5 space-y-4 animate-fadeSlideUp"
        >
          <div>
            <h2 className="text-[16px] font-extrabold text-slate-900">
              Instant Desk Registration &amp; Activation
            </h2>
            <p className="text-[12.5px] text-slate-600">
              For walk-ins who paid Cash/UPI right at the desk — immediately activates their pass!
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-3">
            <input
              type="text"
              required
              placeholder="Member Full Name"
              value={walkInName}
              onChange={(e) => setWalkInName(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            />
            <input
              type="tel"
              required
              placeholder="10-Digit Phone Number"
              value={walkInPhone}
              onChange={(e) => setWalkInPhone(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            />
            <select
              value={walkInPlanId}
              onChange={(e) => setWalkInPlanId(e.target.value)}
              className="h-11 rounded-xl border border-slate-300 bg-white px-3.5 text-[13.5px] font-semibold text-slate-900"
            >
              {(dashboard?.config.plans ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} — {formatPriceFromPaise(p.pricePaise, 'INR')} ({p.durationDays}d)
                </option>
              ))}
            </select>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={addingWalkIn}
              className="h-10 rounded-xl bg-[#0F172A] px-5 text-[13px] font-extrabold text-[#A3E635] hover:bg-slate-800 cursor-pointer"
            >
              {addingWalkIn ? 'Activating…' : 'Confirm Payment & Activate Pass ✓'}
            </button>
          </div>
        </form>
      )}

      {/* 1. PENDING PAYMENT APPROVALS (Cash / UPI Handover at Desk) */}
      <section className="rounded-3xl border border-amber-300 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-black text-slate-900 flex items-center gap-2">
              <Clock className="h-5 w-5 text-amber-600" aria-hidden />
              Pending Payment Approvals ({pendingApprovals.length})
            </h2>
            <p className="text-[12.5px] text-slate-500 mt-0.5">
              Members who scanned your Front-Desk QR — collect Cash/UPI and tap Approve to start their countdown.
            </p>
          </div>
        </div>

        {pendingApprovals.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-5 text-center text-[13px] font-semibold text-slate-500">
            No pending signups waiting for payment right now.
          </p>
        ) : (
          <div className="space-y-2.5">
            {pendingApprovals.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50/50 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-md bg-slate-900 px-2 py-0.5 font-mono text-[11px] font-extrabold text-[#A3E635]">
                      {m.memberCode}
                    </span>
                    <p className="text-[15px] font-black text-slate-900">
                      {m.fullName}
                    </p>
                    <span className="text-[12px] font-mono text-slate-600">
                      {m.phone}
                    </span>
                  </div>
                  <p className="text-[13px] font-bold text-amber-900">
                    {m.planName} ({m.durationDays} days) —{' '}
                    <span className="text-slate-900 font-black">
                      {formatPriceFromPaise(m.feePaise, 'INR')}
                    </span>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyMemberId === m.id}
                    onClick={() => void handleMemberAction(m, 'approve')}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-emerald-600 px-4 text-[12.5px] font-extrabold text-white shadow-sm hover:bg-emerald-700 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="h-4 w-4" aria-hidden />
                    {busyMemberId === m.id
                      ? 'Activating…'
                      : 'Approve Payment & Start Plan ✓'}
                  </button>
                  <button
                    type="button"
                    disabled={busyMemberId === m.id}
                    onClick={() => void handleMemberAction(m, 'reject')}
                    className="inline-flex h-10 items-center gap-1 rounded-xl border border-red-200 bg-white px-3 text-[12px] font-bold text-red-700 hover:bg-red-50 cursor-pointer"
                  >
                    <XCircle className="h-3.5 w-3.5" aria-hidden /> Reject
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 2. 🔴 AUTOMATIC 3-DAY RENEWAL RADAR (Urgent Expiring Soon) */}
      <section className="rounded-3xl border-2 border-red-300 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-[18px] font-black text-red-700 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" aria-hidden />
              🔴 Expiring in ≤ {alertWindowDays} Days — Urgent Renewals ({expiringSoon.length})
            </h2>
            <p className="text-[12.5px] text-slate-600 mt-0.5">
              Zero AI credits needed — automatically calculated every time you open GymOS. Send a 1-tap WhatsApp reminder or renew right away!
            </p>
          </div>
        </div>

        {expiringSoon.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-emerald-200 bg-emerald-50/40 p-5 text-center text-[13px] font-semibold text-emerald-800">
            All active members have more than {alertWindowDays} days remaining!
          </p>
        ) : (
          <div className="space-y-3">
            {expiringSoon.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-red-200 bg-red-50/60 p-4 lg:flex-row lg:items-center lg:justify-between"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-600 px-2.5 py-0.5 text-[11px] font-black text-white tabular-nums">
                      {m.daysRemaining === 0
                        ? 'EXPIRES TODAY'
                        : `${m.daysRemaining} ${m.daysRemaining === 1 ? 'DAY' : 'DAYS'} LEFT`}
                    </span>
                    <p className="text-[15.5px] font-black text-slate-900">
                      {m.fullName}
                    </p>
                    <span className="font-mono text-[12px] text-slate-600">
                      {m.phone}
                    </span>
                  </div>
                  <p className="text-[12.5px] font-semibold text-slate-700">
                    {m.planName} ({formatPriceFromPaise(m.feePaise, 'INR')}) • Ends{' '}
                    <strong>{formatIsoDatePretty(m.endDate)}</strong>
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyMemberId === m.id}
                    onClick={() => void handleMemberAction(m, 'renew', 30)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#0F172A] px-3.5 text-[12.5px] font-extrabold text-[#A3E635] hover:bg-slate-800 cursor-pointer"
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                    Renew Plan (+30 Days)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyReminder(m)}
                    className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 text-[12px] font-bold text-slate-900 hover:bg-slate-50 cursor-pointer"
                  >
                    {copiedId === m.id ? (
                      <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                    ) : (
                      <Copy className="h-3.5 w-3.5" aria-hidden />
                    )}
                    {copiedId === m.id ? 'Copied!' : 'Copy WhatsApp Reminder'}
                  </button>
                  <a
                    href={getGymRenewalWhatsAppLink(business.name, m)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-10 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[12px] font-extrabold text-white hover:bg-emerald-700"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden />
                    WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 3. ⚫ EXPIRED MEMBERS (Clearly Separated — Stop Free Training!) */}
      {expiredMembers.length > 0 && (
        <section className="rounded-3xl border border-slate-800 bg-slate-900 p-5 sm:p-6 text-white shadow-sm space-y-4">
          <div>
            <h2 className="text-[18px] font-black text-white flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-red-400" aria-hidden />
              ⚫ Expired Members ({expiredMembers.length})
            </h2>
            <p className="text-[12.5px] text-slate-400 mt-0.5">
              Daily check-in is automatically locked for expired passes until renewed here.
            </p>
          </div>

          <div className="space-y-2.5">
            {expiredMembers.map((m) => (
              <div
                key={m.id}
                className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-slate-800/70 p-4 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-red-500/20 border border-red-400/40 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase text-red-300">
                      EXPIRED {formatIsoDatePretty(m.endDate)}
                    </span>
                    <p className="text-[15px] font-extrabold text-white">
                      {m.fullName}
                    </p>
                    <span className="font-mono text-[12px] text-slate-400">
                      {m.phone}
                    </span>
                  </div>
                  <p className="text-[12px] text-slate-300">
                    Last plan: {m.planName} ({formatPriceFromPaise(m.feePaise, 'INR')})
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    disabled={busyMemberId === m.id}
                    onClick={() => void handleMemberAction(m, 'renew', m.durationDays)}
                    className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#A3E635] px-3.5 text-[12px] font-black text-[#0F172A] hover:bg-lime-300 cursor-pointer"
                  >
                    Renew (+{m.durationDays}d) ✓
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyReminder(m)}
                    className="inline-flex h-9 items-center gap-1 rounded-xl border border-white/20 bg-white/5 px-3 text-[12px] font-bold text-white hover:bg-white/10 cursor-pointer"
                  >
                    <Copy className="h-3.5 w-3.5" aria-hidden /> Copy Reminder
                  </button>
                  <a
                    href={getGymRenewalWhatsAppLink(business.name, m)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex h-9 items-center gap-1 rounded-xl bg-emerald-600 px-3 text-[12px] font-extrabold text-white hover:bg-emerald-500"
                  >
                    <MessageCircle className="h-3.5 w-3.5" aria-hidden /> WhatsApp
                  </a>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 4. ACTIVE MEMBERS DIRECTORY */}
      <section className="rounded-3xl border border-slate-200 bg-white p-5 sm:p-6 shadow-xs space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-slate-900" aria-hidden />
            <h2 className="text-[18px] font-black text-slate-900">
              Active Members ({activeMembers.length})
            </h2>
          </div>
          <div className="relative w-full sm:w-64">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden
            />
            <input
              type="search"
              placeholder="Search name, phone, GYM-001…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 text-[13px] font-semibold text-slate-900 focus:border-slate-900 focus:bg-white focus:outline-none"
            />
          </div>
        </div>

        {filteredActiveMembers.length === 0 ? (
          <p className="py-6 text-center text-[13px] font-semibold text-slate-500">
            No active members match your search.
          </p>
        ) : (
          <div className="divide-y divide-slate-100">
            {filteredActiveMembers.map((m) => (
              <div
                key={m.id}
                className="py-3.5 flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="space-y-0.5 min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-bold text-slate-700">
                      {m.memberCode}
                    </span>
                    <p className="text-[14.5px] font-extrabold text-slate-900">
                      {m.fullName}
                    </p>
                    {m.checkedInToday && (
                      <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10.5px] font-extrabold text-emerald-800">
                        ✓ Checked In Today
                      </span>
                    )}
                  </div>
                  <p className="text-[12.5px] text-slate-500">
                    {m.phone} • {m.planName} • Expires{' '}
                    <strong className="text-slate-800">
                      {formatIsoDatePretty(m.endDate)}
                    </strong>{' '}
                    • {m.totalCheckIns} visits
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <span
                    className={`rounded-full px-3 py-1 text-[12px] font-black tabular-nums ${
                      m.effectiveStatus === 'expiring_soon'
                        ? 'bg-red-100 text-red-700'
                        : 'bg-lime-100 text-slate-900'
                    }`}
                  >
                    {m.daysRemaining}d left
                  </span>
                  <button
                    type="button"
                    disabled={busyMemberId === m.id}
                    onClick={() => void handleMemberAction(m, 'renew', 30)}
                    className="h-9 rounded-xl border border-slate-200 bg-slate-50 px-3 text-[12px] font-bold text-slate-900 hover:bg-slate-900 hover:text-[#A3E635] transition-colors cursor-pointer"
                  >
                    +30d Renew
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
