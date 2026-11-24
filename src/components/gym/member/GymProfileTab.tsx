import { useState, type RefObject } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertCircle,
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  ChevronDown,
  ChevronRight,
  Clock,
  Download,
  HelpCircle,
  LogOut,
  Palette,
  QrCode,
  ShieldCheck,
  Smartphone,
  Star,
  Volume2,
  VolumeX,
} from 'lucide-react';
import type {
  GymMember,
  GymPreferredShift,
  PublicGymPortalPayload,
} from '../../../types/gym';
import {
  formatIsoDatePretty,
  getFitnessGoalMeta,
  GYM_SHIFT_OPTIONS,
} from '../../../utils/gymValidation';
import { formatPriceFromPaise } from '../../../utils/restaurantValidation';
import { GymBrandMark } from './GymBrandMark';
import type { ResolvedGymBrandTheme } from './gymThemeTokens';
import type { MemberNavTab } from './GymMemberShell';
import { SurfaceCard } from './primitives';

export interface GymProfileTabProps {
  portal: PublicGymPortalPayload;
  businessSlug: string;
  memberPass: GymMember;
  brandTheme: ResolvedGymBrandTheme;
  activeShift: GymPreferredShift;
  updatingShift: boolean;
  onChangeShift: (shift: GymPreferredShift) => void;
  ptTrainerDisplayName: string | null;
  ptTrainerSpecialtyDisplay: string | null;
  ptLeft: number;
  ptSessionsTotal: number;
  balanceDue: number;
  isFrozen: boolean;
  passQrCanvasRef: RefObject<HTMLCanvasElement | null>;
  renewPlanId: string;
  onSelectRenewPlan: (planId: string) => void;
  renewNotice: string | null;
  onConfirmRenewNotice: (notice: string) => void;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onExportCsv: () => void;
  onSaveToHomeScreen: () => void;
  showHomeGuide: boolean;
  onSwitchMember: () => void;
  onJumpToTab: (tab: MemberNavTab) => void;
}

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'GM';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

const HELP_FAQS = [
  {
    q: 'How does Daily Reception Check-In & Streak work?',
    a: 'Tap "Mark Today’s Attendance" on Home or show your Pass QR at the gym desk. Checking in at least once each week keeps your weekly streak alive.',
  },
  {
    q: 'How do I renew, upgrade, or freeze my membership?',
    a: 'Pick your desired plan on the right and show your member code at reception (Cash or UPI). Ask the front desk to pause or resume your plan if travelling.',
  },
  {
    q: 'What are RIR & Estimated 1RM?',
    a: 'RIR (Reps In Reserve) lets you note how many reps remained in the tank during a set. Estimated 1RM calculates strength progress automatically via Epley formula.',
  },
];

/**
 * Integrated Profile, Reception Digital Pass QR, Renewal, Preferences & Help view
 * aligned with FitPro Profile card language and responsive desktop 12-col layout.
 */
export function GymProfileTab({
  portal,
  businessSlug,
  memberPass,
  brandTheme,
  activeShift,
  updatingShift,
  onChangeShift,
  ptTrainerDisplayName,
  ptTrainerSpecialtyDisplay,
  ptLeft,
  ptSessionsTotal,
  balanceDue,
  isFrozen,
  passQrCanvasRef,
  renewPlanId,
  onSelectRenewPlan,
  renewNotice,
  onConfirmRenewNotice,
  soundEnabled,
  onToggleSound,
  onExportCsv,
  onSaveToHomeScreen,
  showHomeGuide,
  onSwitchMember,
  onJumpToTab,
}: GymProfileTabProps) {
  const [helpOpen, setHelpOpen] = useState(false);
  const { accent, accentInk, accentText, presetLabel } = brandTheme;
  const goalMeta = getFitnessGoalMeta(memberPass.fitnessGoal);
  const initials = getInitials(memberPass.fullName);

  return (
    <div className="gym-fade-up grid grid-cols-1 gap-5 lg:grid-cols-12">
      {/* Left Column: Member Identity, Settings & Help */}
      <div className="space-y-4 lg:col-span-5">
        <SurfaceCard variant="hero" className="text-center space-y-4">
          <div className="mx-auto flex flex-col items-center space-y-2.5">
            <div
              className="flex h-18 w-18 items-center justify-center rounded-full border-2 text-[22px] font-black shadow-lg"
              style={{
                borderColor: accent,
                backgroundColor: `${accent}1E`,
                color: accentText,
              }}
            >
              {initials}
            </div>
            <div>
              <h2 className="text-[19px] font-black text-[#F5F7FA]">
                {memberPass.fullName}
              </h2>
              <p className="text-[12px] font-semibold text-[#A4ADBB] mt-0.5">
                {memberPass.memberCode} · {goalMeta.emoji} {goalMeta.label}
              </p>
            </div>
            <div className="flex flex-wrap items-center justify-center gap-1.5">
              <span
                className={`rounded-full px-2.5 py-0.5 text-[11px] font-extrabold capitalize ${
                  isFrozen
                    ? 'bg-sky-500/20 text-sky-300'
                    : memberPass.effectiveStatus === 'active'
                      ? 'bg-[#35D07F]/20 text-[#35D07F]'
                      : memberPass.effectiveStatus === 'expiring_soon'
                        ? 'bg-[#FFB84D]/20 text-[#FFB84D]'
                        : 'bg-[#FF5B62]/20 text-[#FF5B62]'
                }`}
              >
                {isFrozen
                  ? 'Frozen'
                  : memberPass.effectiveStatus.replace('_', ' ')}
              </span>
              {ptTrainerDisplayName && (
                <span className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-[#232933] px-2.5 py-0.5 text-[11px] font-bold text-[#F5F7FA]">
                  <Award
                    className="h-3 w-3"
                    style={{ color: accentText }}
                    aria-hidden
                  />
                  Coach: {ptTrainerDisplayName}
                  {ptTrainerSpecialtyDisplay
                    ? ` (${ptTrainerSpecialtyDisplay})`
                    : ''}
                </span>
              )}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 border-t border-white/[0.07] pt-3.5 text-center">
            <div className="rounded-xl bg-[#111419] p-2.5">
              <p className="text-[10.5px] font-semibold text-[#778191]">
                Check-Ins
              </p>
              <p className="text-[15px] font-black text-[#F5F7FA] tabular-nums">
                {memberPass.totalCheckIns}
              </p>
            </div>
            <div className="rounded-xl bg-[#111419] p-2.5">
              <p className="text-[10.5px] font-semibold text-[#778191]">
                Days Left
              </p>
              <p
                className="text-[15px] font-black tabular-nums"
                style={{ color: accentText }}
              >
                {memberPass.daysRemaining}d
              </p>
            </div>
            <div className="rounded-xl bg-[#111419] p-2.5">
              <p className="text-[10.5px] font-semibold text-[#778191]">
                PT Balance
              </p>
              <p className="text-[15px] font-black text-[#F5F7FA] tabular-nums">
                {ptLeft > 0
                  ? `${ptLeft}${ptSessionsTotal > 0 ? `/${ptSessionsTotal}` : ''}`
                  : '—'}
              </p>
            </div>
          </div>
        </SurfaceCard>

        {/* Batch Shift Selector */}
        <SurfaceCard className="space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-[13px] font-extrabold text-[#F5F7FA]">
              <Clock
                className="h-4 w-4"
                style={{ color: accentText }}
                aria-hidden
              />
              Preferred Gym Batch
            </span>
            <span className="text-[11px] font-medium text-[#778191]">
              {updatingShift ? 'Saving…' : 'Synced to attendance'}
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            {GYM_SHIFT_OPTIONS.map((opt) => {
              const active = activeShift === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  disabled={updatingShift}
                  onClick={() => onChangeShift(opt.value)}
                  className={`min-h-[44px] rounded-xl px-2 py-1.5 text-[11.5px] font-extrabold transition-colors cursor-pointer ${
                    active
                      ? ''
                      : 'bg-[#1D222B] text-[#A4ADBB] hover:text-[#F5F7FA] border border-white/[0.06]'
                  }`}
                  style={
                    active
                      ? { backgroundColor: accent, color: accentInk }
                      : undefined
                  }
                >
                  {opt.emoji} {opt.label}
                </button>
              );
            })}
          </div>
        </SurfaceCard>

        {/* Clean FitPro-Style Settings & Navigation List */}
        <SurfaceCard className="p-2 space-y-1">
          <button
            type="button"
            onClick={() => onJumpToTab('plan')}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-bold text-[#F5F7FA] hover:bg-white/[0.04] cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-[#A4ADBB]" aria-hidden />
              My Training Schedule &amp; Diet
            </span>
            <ChevronRight className="h-4 w-4 text-[#778191]" aria-hidden />
          </button>

          <button
            type="button"
            onClick={() => onJumpToTab('track')}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-bold text-[#F5F7FA] hover:bg-white/[0.04] cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <BarChart3 className="h-4 w-4 text-[#A4ADBB]" aria-hidden />
              My Progress, Body Log &amp; PRs
            </span>
            <ChevronRight className="h-4 w-4 text-[#778191]" aria-hidden />
          </button>

          <button
            type="button"
            onClick={onToggleSound}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-bold text-[#F5F7FA] hover:bg-white/[0.04] cursor-pointer"
          >
            <span className="flex items-center gap-3">
              {soundEnabled ? (
                <Volume2
                  className="h-4 w-4"
                  style={{ color: accentText }}
                  aria-hidden
                />
              ) : (
                <VolumeX className="h-4 w-4 text-[#778191]" aria-hidden />
              )}
              Rest Timer &amp; Chat Audio
            </span>
            <span
              className="rounded-lg px-2 py-0.5 text-[11px] font-black"
              style={
                soundEnabled
                  ? { backgroundColor: `${accent}24`, color: accentText }
                  : { backgroundColor: '#232933', color: '#A4ADBB' }
              }
            >
              {soundEnabled ? 'ON' : 'MUTED'}
            </span>
          </button>

          <button
            type="button"
            onClick={onExportCsv}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-bold text-[#F5F7FA] hover:bg-white/[0.04] cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <Download className="h-4 w-4 text-[#A4ADBB]" aria-hidden />
              Export Workouts &amp; Measurements (.CSV)
            </span>
            <ChevronRight className="h-4 w-4 text-[#778191]" aria-hidden />
          </button>

          <div className="flex min-h-[44px] items-center justify-between px-3 py-2 text-[12px] text-[#A4ADBB]">
            <span className="flex items-center gap-3 font-semibold">
              <Palette className="h-4 w-4 text-[#778191]" aria-hidden />
              Gym Theme
            </span>
            <span className="inline-flex items-center gap-1.5 font-bold text-[#F5F7FA]">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: accent }}
              />
              {presetLabel}
            </span>
          </div>

          <button
            type="button"
            onClick={() => setHelpOpen((prev) => !prev)}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2 text-left text-[13px] font-bold text-[#F5F7FA] hover:bg-white/[0.04] cursor-pointer"
          >
            <span className="flex items-center gap-3">
              <HelpCircle className="h-4 w-4 text-[#A4ADBB]" aria-hidden />
              Help &amp; Member FAQ
            </span>
            <ChevronDown
              className={`h-4 w-4 text-[#778191] transition-transform ${
                helpOpen ? 'rotate-180' : ''
              }`}
              aria-hidden
            />
          </button>

          {helpOpen && (
            <div className="mx-2 mb-2 rounded-xl border border-white/[0.07] bg-[#111419] p-3 space-y-2.5">
              {HELP_FAQS.map((item) => (
                <div key={item.q} className="space-y-0.5">
                  <p className="text-[12px] font-extrabold text-[#F5F7FA]">
                    {item.q}
                  </p>
                  <p className="text-[11.5px] text-[#A4ADBB] leading-relaxed">
                    {item.a}
                  </p>
                </div>
              ))}
            </div>
          )}

          <Link
            to={`/r/${businessSlug}`}
            className="flex min-h-[48px] w-full items-center justify-between rounded-xl px-3 py-2 text-[13px] font-bold text-[#F5F7FA] hover:bg-white/[0.04]"
          >
            <span className="flex items-center gap-3">
              <Star
                className="h-4 w-4"
                style={{ color: accentText }}
                aria-hidden
              />
              Leave a 10-second Google Review
            </span>
            <ChevronRight className="h-4 w-4 text-[#778191]" aria-hidden />
          </Link>
        </SurfaceCard>

        <button
          type="button"
          onClick={onSwitchMember}
          className="gym-tactile flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-white/10 bg-[#171B22] text-[13px] font-extrabold text-[#FF5B62] hover:bg-rose-500/10 cursor-pointer"
        >
          <LogOut className="h-4 w-4" aria-hidden />
          Switch Account · •••• {memberPass.phone.slice(-4)}
        </button>
      </div>

      {/* Right Column: Digital Membership Card, Reception QR & Renewal */}
      <div className="space-y-4 lg:col-span-7">
        <div className="overflow-hidden rounded-3xl border border-white/10 bg-[#171B22] shadow-xl">
          <div className="p-5 space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5 min-w-0">
                <GymBrandMark
                  logoUrl={portal.config.logoUrl}
                  name={portal.business.name}
                  accentColor={accent}
                  inkColor={accentInk}
                  size="sm"
                />
                <div className="min-w-0">
                  <p className="truncate text-[15px] font-black text-[#F5F7FA]">
                    {portal.business.name}
                  </p>
                  <p className="text-[11px] font-semibold text-[#A4ADBB]">
                    Official Digital Pass
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#232933] px-2.5 py-1 text-[11px] font-bold text-[#A4ADBB]">
                <QrCode className="h-3.5 w-3.5" aria-hidden />
                Reception Scan
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-white/[0.08] pt-3">
              <div>
                <p className="text-[11px] font-semibold text-[#778191]">
                  Current Plan
                </p>
                <p className="text-[15px] font-black text-[#F5F7FA]">
                  {memberPass.planName}
                </p>
              </div>
              <div className="text-right">
                <p className="text-[11px] font-semibold text-[#778191]">
                  Valid Until
                </p>
                <p
                  className="text-[14px] font-black tabular-nums"
                  style={{ color: accentText }}
                >
                  {memberPass.endDate
                    ? formatIsoDatePretty(memberPass.endDate)
                    : 'Pending Desk Approval'}
                </p>
              </div>
            </div>
          </div>

          <div className="bg-white p-5 text-center space-y-2">
            <div className="inline-flex rounded-2xl border border-slate-200 bg-white p-2.5 shadow-xs">
              <canvas ref={passQrCanvasRef} />
            </div>
            <p className="text-[12px] font-bold text-slate-700">
              Show QR at gym reception for check-in or renewal ({memberPass.memberCode})
            </p>
          </div>
        </div>

        {balanceDue > 0 && (
          <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex items-start gap-3">
            <AlertCircle
              className="h-5 w-5 text-amber-400 shrink-0 mt-0.5"
              aria-hidden
            />
            <div>
              <p className="text-[14px] font-extrabold text-amber-200 tabular-nums">
                Installment Balance Due:{' '}
                {formatPriceFromPaise(balanceDue, 'INR')}
              </p>
              <p className="text-[12px] text-amber-300/80 mt-0.5">
                {memberPass.balanceDueDate
                  ? `Settle by ${formatIsoDatePretty(memberPass.balanceDueDate)} via UPI or Cash at reception.`
                  : 'Settle via UPI or Cash at reception on your next visit.'}
              </p>
            </div>
          </div>
        )}

        <SurfaceCard className="space-y-3">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-[15px] font-extrabold text-[#F5F7FA]">
                Renew or Upgrade Plan
              </h3>
              <p className="text-[12px] text-[#A4ADBB]">
                Select a plan below &amp; confirm payment via Cash / UPI at reception
              </p>
            </div>
            <ShieldCheck
              className="h-4.5 w-4.5 text-[#35D07F] shrink-0"
              aria-hidden
            />
          </div>

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {portal.config.plans.map((plan) => {
              const selected = renewPlanId === plan.id;
              const isPopular =
                plan.durationDays === 90 ||
                (plan.badge ?? '').toLowerCase().includes('popular');
              return (
                <button
                  key={plan.id}
                  type="button"
                  onClick={() => onSelectRenewPlan(plan.id)}
                  className={`flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all cursor-pointer ${
                    selected
                      ? 'bg-[#1D222B]'
                      : 'border-white/10 bg-[#111419] hover:border-white/25'
                  }`}
                  style={
                    selected
                      ? {
                          borderColor: accent,
                          boxShadow: `0 0 0 1px ${accent}`,
                        }
                      : undefined
                  }
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[13.5px] font-extrabold text-[#F5F7FA]">
                      {plan.name}
                    </span>
                    {isPopular && (
                      <span
                        className="shrink-0 rounded-full px-2 py-0.5 text-[10px] font-black"
                        style={{ backgroundColor: accent, color: accentInk }}
                      >
                        Popular
                      </span>
                    )}
                  </div>
                  <div className="mt-2 flex items-baseline justify-between">
                    <span className="text-[11px] font-medium text-[#778191]">
                      {plan.durationDays} days
                    </span>
                    <span
                      className="text-[15px] font-black tabular-nums"
                      style={{ color: accentText }}
                    >
                      {formatPriceFromPaise(plan.pricePaise, 'INR')}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => {
              const chosen = portal.config.plans.find(
                (p) => p.id === renewPlanId,
              );
              onConfirmRenewNotice(
                `Selected ${chosen?.name ?? 'Plan'} (${formatPriceFromPaise(chosen?.pricePaise ?? 0, 'INR')}). Show pass ${memberPass.memberCode} at reception to pay via UPI/Cash & extend immediately.`,
              );
            }}
            className="gym-tactile flex min-h-[46px] w-full items-center justify-center gap-2 rounded-2xl text-[13.5px] font-black cursor-pointer"
            style={{ backgroundColor: accent, color: accentInk }}
          >
            Select Plan for Desk Renewal <ArrowRight className="h-4 w-4" aria-hidden />
          </button>

          {renewNotice && (
            <p className="rounded-xl border border-[#35D07F]/35 bg-[#35D07F]/10 p-3 text-[12px] font-semibold text-emerald-200">
              {renewNotice}
            </p>
          )}

          <button
            type="button"
            onClick={onSaveToHomeScreen}
            className="gym-tactile flex min-h-[44px] w-full items-center justify-center gap-2 rounded-xl border border-white/10 bg-[#111419] text-[12.5px] font-extrabold cursor-pointer hover:bg-white/[0.04]"
            style={{ color: accentText }}
          >
            <Smartphone className="h-4 w-4" aria-hidden />
            Save Gym Pass to Mobile Home Screen
          </button>

          {showHomeGuide && (
            <div className="rounded-xl bg-[#111419] border border-white/[0.06] p-3 text-[12px] text-[#A4ADBB] space-y-1">
              <p>
                <strong className="text-[#F5F7FA]">iPhone Safari:</strong> Tap
                Share → Add to Home Screen.
              </p>
              <p>
                <strong className="text-[#F5F7FA]">Android Chrome:</strong> Tap
                ⋮ Menu → Add to Home screen.
              </p>
            </div>
          )}
        </SurfaceCard>
      </div>
    </div>
  );
}
