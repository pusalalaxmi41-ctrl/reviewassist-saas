import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  KeyRound,
  UtensilsCrossed,
  Lock,
  Loader2,
  SearchX,
  AlertCircle,
  UserCheck,
  LogOut,
} from 'lucide-react';
import type { Business } from '../types/business';
import type {
  PublicStaffLoginOption,
  RestaurantProfile,
  RestaurantTable,
  VerifiedStaffMemberSession,
} from '../types/restaurant';
import { businessRepository } from '../services/storage';
import {
  STAFF_ROLE_METADATA,
  hashStaffPin,
  validateStaffPinFormat,
} from '../utils/restaurantValidation';
import { RestaurantFloorAndStaffPanel } from '../components/dashboard/RestaurantFloorAndStaffPanel';
import { Button } from '../components/common/Button';

export default function RestaurantStaffVerificationPage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();

  const [business, setBusiness] = useState<Business | null>(null);
  const [profile, setProfile] = useState<RestaurantProfile | null>(null);
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [staffDirectory, setStaffDirectory] = useState<
    PublicStaffLoginOption[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Login inputs
  const [selectedStaffCode, setSelectedStaffCode] = useState<string>('');
  const [manualStaffCode, setManualStaffCode] = useState<string>('');
  const [legacyStaffLabel, setLegacyStaffLabel] = useState('Floor Staff');
  const [pinInput, setPinInput] = useState('');

  // Authenticated staff session
  const [verifiedPinHash, setVerifiedPinHash] = useState<string | null>(null);
  const [staffSession, setStaffSession] =
    useState<VerifiedStaffMemberSession | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function loadRestaurant() {
      if (!businessSlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      const biz = await businessRepository.getBusinessBySlug(businessSlug);
      setBusiness(biz);
      if (biz) {
        try {
          const directory =
            await businessRepository.getPublicStaffLoginDirectory(biz.slug);
          setStaffDirectory(directory);
          if (directory.length > 0) {
            setSelectedStaffCode(directory[0].staffCode);
          }
        } catch {
          setStaffDirectory([]);
        }
        try {
          const [prof, tbls] = await Promise.all([
            businessRepository.getRestaurantProfile(biz.id),
            businessRepository.getRestaurantTables(biz.id),
          ]);
          setProfile(prof);
          setTables(tbls);
        } catch {
          // ignore if public staff phone hasn't authenticated as owner
        }
      }
      setLoading(false);
    }
    void loadRestaurant();
  }, [businessSlug]);

  async function handleUnlockWithPin(e: React.FormEvent) {
    e.preventDefault();
    if (!business) return;
    setAuthError(null);

    const check = validateStaffPinFormat(pinInput);
    if (!check.ok) {
      setAuthError(check.error);
      return;
    }

    const effectiveStaffCode =
      selectedStaffCode === '__manual__'
        ? manualStaffCode.trim().toUpperCase() || null
        : selectedStaffCode.trim().toUpperCase() || null;

    setVerifying(true);
    try {
      const hashed = await hashStaffPin(business.slug, check.pin);
      const session = await businessRepository.verifyStaffMemberPin({
        businessSlug: business.slug,
        staffCode: effectiveStaffCode,
        staffPinHash: hashed,
      });

      // Preserve user-typed legacy label if authenticated via legacy shared PIN
      const resolvedSession: VerifiedStaffMemberSession =
        session.staffId === null &&
        session.staffCode === 'STAFF' &&
        legacyStaffLabel.trim()
          ? {
              ...session,
              fullName: legacyStaffLabel.trim(),
              staffLabel: legacyStaffLabel.trim(),
            }
          : session;

      setStaffSession(resolvedSession);
      setVerifiedPinHash(hashed);
      setPinInput('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  function handleLockSession() {
    setVerifiedPinHash(null);
    setStaffSession(null);
    setPinInput('');
    setAuthError(null);
  }

  if (loading) {
    return (
      <div
        role="status"
        className="mx-auto max-w-md bistro-card p-12 text-center"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#1E1B4B]"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-medium text-[#6B7280]">
          Loading Waiter Floor App…
        </p>
      </div>
    );
  }

  if (!business) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-md bistro-card p-8 text-center space-y-3"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-extrabold text-[#111827]">
          Restaurant not found
        </h1>
        <p className="text-[14px] text-[#6B7280]">
          Please check the restaurant URL and try again.
        </p>
      </div>
    );
  }

  const roleDisplayLabel = staffSession
    ? (STAFF_ROLE_METADATA[staffSession.role]?.label ?? 'Staff')
    : '';

  return (
    <div className="mx-auto w-full max-w-md space-y-4 pb-10 animate-fadeSlideUp">
      {/* Top Bar — WAITER MOBILE FLOOR APP */}
      <header className="bistro-card px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#1E1B4B] text-[#D2DB76]">
              <UtensilsCrossed className="h-4 w-4" aria-hidden />
            </span>
            <div className="min-w-0">
              <h1 className="text-[14px] font-extrabold uppercase tracking-wider text-[#111827]">
                WAITER FLOOR APP
              </h1>
              <p className="truncate text-[12px] font-medium text-[#6B7280]">
                {business.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/r/${business.slug}/menu`}
              className="rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3 py-1.5 text-[12px] font-bold text-[#111827] hover:border-[#1E1B4B]"
            >
              Menu
            </Link>
            {verifiedPinHash && (
              <button
                type="button"
                onClick={handleLockSession}
                aria-label="Switch Staff or Lock Floor App"
                title="Switch Staff / Lock"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#1E1B4B]/15 bg-[#FFFFFF] px-2.5 text-[11px] font-bold text-[#111827] hover:bg-[#F8F9FA] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span>Lock</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Personal Staff Identity Strip */}
        {verifiedPinHash && staffSession && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-xl bg-[#1E1B4B] px-3.5 py-2.5 text-[#FFFFFF]"
          >
            <div className="flex items-center gap-2 min-w-0">
              <UserCheck
                className="h-4 w-4 shrink-0 text-[#D2DB76]"
                aria-hidden
              />
              <p className="truncate text-[12.5px] font-bold">
                Logged in as:{' '}
                <span className="text-[#D2DB76]">
                  {staffSession.fullName} ({staffSession.staffCode})
                </span>{' '}
                • {roleDisplayLabel}
              </p>
            </div>
            <Lock className="h-3.5 w-3.5 shrink-0 text-white/60" aria-hidden />
          </div>
        )}
      </header>

      {/* Personal Waiter Login Screen vs. 3-Tab Waiter Floor Console */}
      {!verifiedPinHash || !staffSession ? (
        <form
          onSubmit={(e) => void handleUnlockWithPin(e)}
          className="bistro-card p-6 sm:p-7 space-y-5"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76] shadow-sm">
              <KeyRound className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-[22px] font-extrabold tracking-tight text-[#111827]">
              Personal Waiter Login
            </h2>
            <p className="text-[13px] text-[#6B7280]">
              Select your name or enter your Staff ID &amp; personal 4-digit PIN for{' '}
              <strong>{business.name}</strong>.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
            >
              <AlertCircle
                className="h-4 w-4 shrink-0 text-red-700"
                aria-hidden
              />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-4">
            {staffDirectory.length > 0 ? (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="waiterRosterSelect"
                    className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]"
                  >
                    Select Your Name / Staff ID
                  </label>
                  <select
                    id="waiterRosterSelect"
                    value={selectedStaffCode}
                    onChange={(e) => setSelectedStaffCode(e.target.value)}
                    className="block h-12 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] font-bold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                  >
                    {staffDirectory.map((member) => (
                      <option key={member.id} value={member.staffCode}>
                        {member.fullName} ({member.staffCode}) —{' '}
                        {STAFF_ROLE_METADATA[member.role]?.label ?? member.role}
                      </option>
                    ))}
                    <option value="__manual__">
                      Enter Staff ID Manually / Legacy Shared PIN
                    </option>
                  </select>
                </div>

                {selectedStaffCode === '__manual__' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="manualStaffIdInput"
                      className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]"
                    >
                      Staff ID (Optional — e.g. WTR-01)
                    </label>
                    <input
                      id="manualStaffIdInput"
                      type="text"
                      maxLength={20}
                      placeholder="e.g. WTR-01 (leave blank for shared PIN)"
                      value={manualStaffCode}
                      onChange={(e) =>
                        setManualStaffCode(e.target.value.toUpperCase())
                      }
                      className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3.5 font-mono text-[14px] font-bold uppercase text-[#1E1B4B] focus:border-[#1E1B4B] focus:bg-[#FFFFFF] focus:outline-none"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="staffNameLabelInput"
                  className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]"
                >
                  Staff Name / Station
                </label>
                <input
                  id="staffNameLabelInput"
                  type="text"
                  maxLength={60}
                  placeholder="e.g. Waiter Rahul"
                  value={legacyStaffLabel}
                  onChange={(e) => setLegacyStaffLabel(e.target.value)}
                  className="block h-11 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[14px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="staffPinPadInput"
                className="block text-[12px] font-bold uppercase tracking-wider text-[#6B7280]"
              >
                Personal 4–6 Digit PIN
              </label>
              <input
                id="staffPinPadInput"
                type="password"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="••••"
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="block h-14 w-full rounded-xl border border-[#1E1B4B]/25 bg-[#F8F9FA] px-4 text-center font-mono text-[26px] font-extrabold tracking-[0.35em] text-[#1E1B4B] focus:border-[#1E1B4B] focus:bg-[#FFFFFF] focus:outline-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full min-h-12 text-[15px]"
            disabled={verifying || pinInput.trim().length < 4}
          >
            <KeyRound className="h-4 w-4 text-[#D2DB76]" aria-hidden />
            {verifying ? 'Verifying Staff PIN…' : 'Unlock Staff Floor'}
          </Button>
        </form>
      ) : (
        <RestaurantFloorAndStaffPanel
          business={business}
          profile={profile}
          tables={tables}
          mode="staff_portal"
          staffPinHash={verifiedPinHash}
          staffLabel={staffSession.staffLabel}
        />
      )}
    </div>
  );
}
