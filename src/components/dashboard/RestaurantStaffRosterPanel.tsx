import { useState } from 'react';
import {
  Users,
  Plus,
  KeyRound,
  Trash2,
  ExternalLink,
  CheckCircle2,
  ShieldCheck,
  Eye,
  EyeOff,
  Award,
  X,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  RestaurantStaffMember,
  RestaurantStaffRole,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  ALLOWED_STAFF_ROLES,
  STAFF_ROLE_METADATA,
  formatStaffAuditLabel,
  generateNextStaffCode,
  hashStaffPin,
  validateStaffPinFormat,
} from '../../utils/restaurantValidation';
import { Button } from '../common/Button';

interface Props {
  business: Business;
  isBusinessLive: boolean;
  staffMembers: RestaurantStaffMember[];
  staffVerificationCountsToday: Record<string, number>;
  onStaffChanged: (next: RestaurantStaffMember[]) => void;
  onStatus: (msg: string) => void;
  onError: (err: string) => void;
}

export function RestaurantStaffRosterPanel({
  business,
  isBusinessLive,
  staffMembers,
  staffVerificationCountsToday,
  onStaffChanged,
  onStatus,
  onError,
}: Props) {
  const [fullName, setFullName] = useState('');
  const [role, setRole] = useState<RestaurantStaffRole>('waiter');
  const [customStaffCode, setCustomStaffCode] = useState('');
  const [pinInput, setPinInput] = useState('');
  const [showAddPin, setShowAddPin] = useState(false);
  const [creating, setCreating] = useState(false);

  // Reset PIN inline state
  const [resettingId, setResettingId] = useState<string | null>(null);
  const [resetPinValue, setResetPinValue] = useState('');
  const [savingMemberId, setSavingMemberId] = useState<string | null>(null);

  const suggestedCode = generateNextStaffCode(
    role,
    staffMembers.map((m) => m.staffCode),
  );

  const activeCount = staffMembers.filter((m) => m.isActive).length;
  const totalVerifiedToday = Object.values(
    staffVerificationCountsToday,
  ).reduce((sum, n) => sum + n, 0);

  async function handleAddStaff(e: React.FormEvent) {
    e.preventDefault();
    const pinCheck = validateStaffPinFormat(pinInput);
    if (!pinCheck.ok) {
      onError(pinCheck.error);
      return;
    }

    setCreating(true);
    try {
      const sanitizedCode = customStaffCode
        .trim()
        .toUpperCase()
        .replace(/\s+/g, '-')
        .replace(/[^A-Z0-9-]/g, '');
      const pinHash = await hashStaffPin(business.slug, pinCheck.pin);
      const created = await businessRepository.createRestaurantStaffMember(
        business.id,
        {
          fullName: fullName.trim(),
          role,
          staffCode: sanitizedCode.length >= 2 ? sanitizedCode : suggestedCode,
          pinHash,
          isActive: true,
        },
      );
      const next = [...staffMembers, created].sort((a, b) =>
        a.staffCode.localeCompare(b.staffCode),
      );
      onStaffChanged(next);
      setFullName('');
      setCustomStaffCode('');
      setPinInput('');
      setShowAddPin(false);
      onStatus(
        `Added ${created.fullName} (${created.staffCode}) — personal PIN ready for Waiter Floor App!`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleActive(member: RestaurantStaffMember) {
    setSavingMemberId(member.id);
    try {
      const updated = await businessRepository.updateRestaurantStaffMember(
        business.id,
        member.id,
        {
          fullName: member.fullName,
          role: member.role,
          staffCode: member.staffCode,
          isActive: !member.isActive,
        },
      );
      onStaffChanged(
        staffMembers.map((m) => (m.id === updated.id ? updated : m)),
      );
      onStatus(
        `${updated.fullName} (${updated.staffCode}) is now ${updated.isActive ? 'Active' : 'Inactive'}.`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSavingMemberId(null);
    }
  }

  async function handleSaveResetPin(member: RestaurantStaffMember) {
    const pinCheck = validateStaffPinFormat(resetPinValue);
    if (!pinCheck.ok) {
      onError(pinCheck.error);
      return;
    }
    setSavingMemberId(member.id);
    try {
      const pinHash = await hashStaffPin(business.slug, pinCheck.pin);
      const updated = await businessRepository.updateRestaurantStaffMember(
        business.id,
        member.id,
        {
          fullName: member.fullName,
          role: member.role,
          staffCode: member.staffCode,
          pinHash,
          isActive: member.isActive,
        },
      );
      onStaffChanged(
        staffMembers.map((m) => (m.id === updated.id ? updated : m)),
      );
      setResettingId(null);
      setResetPinValue('');
      onStatus(
        `Updated personal PIN for ${updated.fullName} (${updated.staffCode}).`,
      );
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSavingMemberId(null);
    }
  }

  async function handleDeleteStaff(member: RestaurantStaffMember) {
    setSavingMemberId(member.id);
    try {
      await businessRepository.deleteRestaurantStaffMember(
        business.id,
        member.id,
      );
      onStaffChanged(staffMembers.filter((m) => m.id !== member.id));
      onStatus(`Removed ${member.fullName} (${member.staffCode}) from roster.`);
    } catch (err) {
      onError((err as Error).message);
    } finally {
      setSavingMemberId(null);
    }
  }

  return (
    <div className="space-y-6 animate-fadeSlideUp">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
            Staff &amp; Waiters
          </h1>
          <p className="mt-1 text-[14px] text-[#6B7280]">
            Assign each waiter, cashier, chef, or manager a personal Staff ID and 4–6 digit PIN so every Loyalty Star and Order Approval logs exactly who verified it.
          </p>
        </div>
        {isBusinessLive && (
          <a
            href={`/r/${business.slug}/staff`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-11 shrink-0 items-center gap-2 rounded-xl bg-[#1E1B4B] px-4 text-[13px] font-bold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all"
          >
            Open Waiter Mobile Floor App
            <ExternalLink className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
          </a>
        )}
      </div>

      {/* 3 Compact Team Summary Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="bistro-card p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
              Total Staff Roster
            </p>
            <p className="mt-1 text-[28px] font-extrabold text-[#111827] tabular-nums">
              {staffMembers.length}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#F8F9FA] border border-[#1E1B4B]/10 text-[#1E1B4B]">
            <Users className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <div className="bistro-card p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
              Active Floor Accounts
            </p>
            <p className="mt-1 text-[28px] font-extrabold text-[#059669] tabular-nums">
              {activeCount}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-200 text-[#059669]">
            <ShieldCheck className="h-5 w-5" aria-hidden />
          </span>
        </div>

        <div className="bistro-card p-5 flex items-center justify-between">
          <div>
            <p className="text-[12px] font-bold uppercase tracking-wider text-[#6B7280]">
              Loyalty QRs Verified Today
            </p>
            <p className="mt-1 text-[28px] font-extrabold text-[#1E1B4B] tabular-nums">
              {totalVerifiedToday}
            </p>
          </div>
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#D2DB76]/40 border border-[#D2DB76] text-[#1E1B4B]">
            <Award className="h-5 w-5" aria-hidden />
          </span>
        </div>
      </div>

      {/* Prominent + Add Staff / Waiter Form */}
      <form
        onSubmit={(e) => void handleAddStaff(e)}
        className="bistro-card p-6 sm:p-7 space-y-5"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
            <Plus className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <h2 className="text-[18px] font-extrabold text-[#111827]">
              + Add Staff / Waiter
            </h2>
            <p className="text-[13px] text-[#6B7280]">
              Add as many team members as you need — each PIN is securely hashed before saving.
            </p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label
              htmlFor="staffFullName"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Full Name
            </label>
            <input
              id="staffFullName"
              type="text"
              required
              maxLength={80}
              placeholder="e.g. Ravi Kumar"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="staffRole"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Role
            </label>
            <select
              id="staffRole"
              value={role}
              onChange={(e) => setRole(e.target.value as RestaurantStaffRole)}
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
            >
              {ALLOWED_STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {STAFF_ROLE_METADATA[r].label}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="staffCodeInput"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Staff ID (Auto: {suggestedCode})
            </label>
            <input
              id="staffCodeInput"
              name="vitaran_new_staff_code"
              type="text"
              autoComplete="off"
              maxLength={20}
              placeholder={suggestedCode}
              value={customStaffCode}
              onChange={(e) =>
                setCustomStaffCode(
                  e.target.value
                    .toUpperCase()
                    .replace(/\s+/g, '-')
                    .replace(/[^A-Z0-9-]/g, ''),
                )
              }
              className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3.5 font-mono text-[14px] font-bold uppercase text-[#1E1B4B] placeholder:text-[#6B7280] focus:border-[#1E1B4B] focus:bg-[#FFFFFF] focus:outline-none"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="staffPinInput"
              className="block text-[13px] font-semibold text-[#111827]"
            >
              Personal 4–6 Digit PIN
            </label>
            <div className="relative">
              <input
                id="staffPinInput"
                name="vitaran_new_staff_pin"
                type={showAddPin ? 'text' : 'password'}
                autoComplete="new-password"
                inputMode="numeric"
                pattern="[0-9]{4,6}"
                maxLength={6}
                required
                placeholder="e.g. 2468"
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] pl-3.5 pr-10 font-mono text-[15px] font-bold tracking-widest text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
              />
              <button
                type="button"
                aria-label={showAddPin ? 'Hide PIN' : 'Show PIN'}
                onClick={() => setShowAddPin((v) => !v)}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1 text-[#6B7280] hover:text-[#111827] cursor-pointer"
              >
                {showAddPin ? (
                  <EyeOff className="h-4 w-4" aria-hidden />
                ) : (
                  <Eye className="h-4 w-4" aria-hidden />
                )}
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <p className="text-[12px] text-[#6B7280]">
            Waiters log in at <span className="font-mono font-semibold text-[#1E1B4B]">/r/{business.slug}/staff</span> using their name/ID + personal PIN.
          </p>
          <Button type="submit" variant="primary" loading={creating}>
            <Plus className="h-4 w-4" aria-hidden /> Add Staff Member
          </Button>
        </div>
      </form>

      {/* Clean Staff Roster Table */}
      <div className="bistro-card overflow-hidden">
        <div className="border-b border-[#1E1B4B]/10 px-6 py-4 flex items-center justify-between">
          <h2 className="text-[17px] font-extrabold text-[#111827]">
            Active Staff Directory ({staffMembers.length})
          </h2>
          <span className="text-[12px] font-semibold text-[#6B7280]">
            Live Today&apos;s Loyalty QR Audit
          </span>
        </div>

        {staffMembers.length === 0 ? (
          <div className="p-10 text-center space-y-2">
            <Users className="mx-auto h-10 w-10 text-[#6B7280]/60" aria-hidden />
            <p className="text-[15px] font-bold text-[#111827]">
              No individual staff added yet
            </p>
            <p className="mx-auto max-w-md text-[13px] text-[#6B7280]">
              Add your waiters, cashiers, chefs, and managers above to give each person a personal Staff ID (like WTR-01) and track who awards every Loyalty Star.
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#1E1B4B]/10">
            {staffMembers.map((member) => {
              const roleMeta = STAFF_ROLE_METADATA[member.role];
              const auditLabel = formatStaffAuditLabel(
                member.fullName,
                member.staffCode,
              );
              const verifiedToday =
                staffVerificationCountsToday[auditLabel] ?? 0;
              const isResetting = resettingId === member.id;
              const isBusy = savingMemberId === member.id;

              return (
                <div
                  key={member.id}
                  className={`p-4 sm:px-6 transition-colors ${
                    member.isActive ? 'bg-[#FFFFFF]' : 'bg-[#F8F9FA] opacity-75'
                  }`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex flex-wrap items-center gap-3 min-w-0">
                      <span className="inline-flex items-center rounded-xl bg-[#1E1B4B] px-3 py-1.5 font-mono text-[12px] font-extrabold text-[#D2DB76] tracking-wider">
                        {member.staffCode}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-extrabold text-[#111827] truncate">
                            {member.fullName}
                          </p>
                          <span
                            className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${roleMeta.badgeBg} ${roleMeta.badgeText}`}
                          >
                            {roleMeta.label}
                          </span>
                          {!member.isActive && (
                            <span className="rounded-full bg-gray-200 px-2 py-0.5 text-[10px] font-bold uppercase text-gray-700">
                              Inactive
                            </span>
                          )}
                        </div>
                        <p className="mt-0.5 text-[12px] font-medium text-[#6B7280] flex items-center gap-1.5">
                          <CheckCircle2
                            className="h-3.5 w-3.5 text-[#059669]"
                            aria-hidden
                          />
                          <span>
                            Verified today:{' '}
                            <strong className="text-[#111827] tabular-nums">
                              {verifiedToday}
                            </strong>{' '}
                            Customer Loyalty QR{verifiedToday === 1 ? '' : 's'}
                          </span>
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {/* Active/Inactive Switch */}
                      <button
                        type="button"
                        role="switch"
                        aria-checked={member.isActive}
                        aria-label={`Toggle active status for ${member.fullName}`}
                        disabled={isBusy}
                        onClick={() => void handleToggleActive(member)}
                        className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-[12px] font-bold transition-colors cursor-pointer ${
                          member.isActive
                            ? 'border-emerald-200 bg-emerald-50 text-[#059669] hover:bg-emerald-100'
                            : 'border-gray-300 bg-white text-[#6B7280] hover:bg-gray-100'
                        }`}
                      >
                        {member.isActive ? 'Active' : 'Disabled'}
                      </button>

                      {/* Reset PIN */}
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => {
                          setResettingId(isResetting ? null : member.id);
                          setResetPinValue('');
                        }}
                        className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[12px] font-bold text-[#1E1B4B] hover:bg-[#F8F9FA] cursor-pointer"
                      >
                        <KeyRound className="h-3.5 w-3.5" aria-hidden />
                        Reset PIN
                      </button>

                      {/* Remove */}
                      <button
                        type="button"
                        disabled={isBusy}
                        aria-label={`Delete ${member.fullName}`}
                        onClick={() => void handleDeleteStaff(member)}
                        className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-red-200 bg-[#FFFFFF] text-red-600 hover:bg-red-50 cursor-pointer"
                      >
                        <Trash2 className="h-3.5 w-3.5" aria-hidden />
                      </button>
                    </div>
                  </div>

                  {/* Inline Reset PIN Drawer */}
                  {isResetting && (
                    <div className="mt-3 flex flex-wrap items-center gap-2.5 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] p-3 animate-fadeSlideUp">
                      <span className="text-[12px] font-bold text-[#111827]">
                        New 4–6 Digit PIN for {member.fullName}:
                      </span>
                      <input
                        type="password"
                        inputMode="numeric"
                        maxLength={6}
                        placeholder="e.g. 5678"
                        value={resetPinValue}
                        onChange={(e) =>
                          setResetPinValue(
                            e.target.value.replace(/\D/g, '').slice(0, 6),
                          )
                        }
                        className="h-9 w-36 rounded-lg border border-[#1E1B4B]/25 bg-[#FFFFFF] px-3 font-mono text-[14px] font-bold tracking-widest text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                      />
                      <button
                        type="button"
                        disabled={isBusy || resetPinValue.length < 4}
                        onClick={() => void handleSaveResetPin(member)}
                        className="h-9 rounded-lg bg-[#1E1B4B] px-3.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#2E2A6E] disabled:opacity-50 cursor-pointer"
                      >
                        Save New PIN
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setResettingId(null);
                          setResetPinValue('');
                        }}
                        className="h-9 rounded-lg px-2 text-[#6B7280] hover:bg-gray-200 cursor-pointer"
                      >
                        <X className="h-4 w-4" aria-hidden />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
