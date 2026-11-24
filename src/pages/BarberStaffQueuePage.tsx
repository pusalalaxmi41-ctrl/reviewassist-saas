import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  Scissors,
  KeyRound,
  Lock,
  Loader2,
  SearchX,
  AlertCircle,
  LogOut,
} from 'lucide-react';
import type { Business } from '../types/business';
import type {
  PublicStaffLoginOption,
  VerifiedStaffMemberSession,
} from '../types/restaurant';
import { businessRepository } from '../services/storage';
import {
  STAFF_ROLE_METADATA,
  hashStaffPin,
  validateStaffPinFormat,
} from '../utils/restaurantValidation';
import { BarberQueueManagerView } from '../components/dashboard/BarberQueueManagerView';
import { resolveBarberPortrait } from '../config/barberMedia';
import { loadBusinessQRSettings } from '../services/qr/qrGenerator';
import { Button } from '../components/common/Button';

export default function BarberStaffQueuePage() {
  const { businessSlug } = useParams<{ businessSlug: string }>();

  const [business, setBusiness] = useState<Business | null>(null);
  const [pendingOwnedBusiness, setPendingOwnedBusiness] =
    useState<Business | null>(null);
  const [staffDirectory, setStaffDirectory] = useState<
    PublicStaffLoginOption[]
  >([]);
  const [loading, setLoading] = useState(true);

  // Login inputs
  const [selectedStaffCode, setSelectedStaffCode] = useState<string>('');
  const [manualStaffCode, setManualStaffCode] = useState<string>('');
  const [legacyBarberLabel, setLegacyBarberLabel] = useState('Barber');
  const [pinInput, setPinInput] = useState('');

  // Authenticated barber session
  const [verifiedPinHash, setVerifiedPinHash] = useState<string | null>(null);
  const [staffSession, setStaffSession] =
    useState<VerifiedStaffMemberSession | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    async function loadShop() {
      if (!businessSlug) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setPendingOwnedBusiness(null);

      // 1. Prefer direct PostgreSQL RPC (no Edge lookup rate-limit)
      let biz: Business | null = null;
      try {
        const queuePayload =
          await businessRepository.getPublicBarberQueueStatus(businessSlug);
        if (queuePayload?.business) {
          biz = {
            id: queuePayload.business.id,
            slug: queuePayload.business.slug,
            name: queuePayload.business.name,
            category: queuePayload.business.category,
            city: queuePayload.business.city,
            googleReviewUrl: queuePayload.business.googleReviewUrl,
            googleReviewUrlIsPlaceholder: false,
            status: 'active',
            accountState: 'active',
            createdAt: queuePayload.config.createdAt ?? new Date().toISOString(),
          };
        }
      } catch {
        // fall through to getBusinessBySlug
      }

      // 2. Secondary lookup via getBusinessBySlug
      if (!biz) {
        biz = await businessRepository.getBusinessBySlug(businessSlug);
      }

      // 3. If still null, check if signed-in owner owns a pending/inactive shop with this slug
      if (!biz) {
        try {
          const owned = await businessRepository.getBusinesses();
          const match = owned.find(
            (b) => b.slug.toLowerCase() === businessSlug.trim().toLowerCase(),
          );
          if (match) {
            setPendingOwnedBusiness(match);
          }
        } catch {
          // unauthenticated visitor — ignore
        }
      }

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
      }
      setLoading(false);
    }
    void loadShop();
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

      const resolvedSession: VerifiedStaffMemberSession =
        session.staffId === null &&
        session.staffCode === 'STAFF' &&
        legacyBarberLabel.trim()
          ? {
              ...session,
              fullName: legacyBarberLabel.trim(),
              staffLabel: legacyBarberLabel.trim(),
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
          Loading Barber Chair App…
        </p>
      </div>
    );
  }

  if (!business) {
    return (
      <div
        role="alert"
        className="mx-auto max-w-md bistro-card p-8 text-center space-y-4"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#1E1B4B] text-[#D2DB76]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        {pendingOwnedBusiness ? (
          <>
            <h1 className="text-[22px] font-extrabold text-[#111827]">
              {pendingOwnedBusiness.name} is awaiting activation
            </h1>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              This shop currently has status{' '}
              <strong className="text-[#111827]">
                {pendingOwnedBusiness.status ?? 'pending'}
              </strong>
              . Approve it in the Admin Panel to unlock the public Live Queue
              &amp; Barber Chair App, or manage it directly in your Owner
              Dashboard.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to={`/dashboard?slug=${pendingOwnedBusiness.slug}&tab=queue`}
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1E1B4B] px-4 text-[14px] font-bold text-[#FFFFFF] hover:bg-[#2E2A6E]"
              >
                Open Live Queue in Owner Dashboard
              </Link>
              <Link
                to="/admin"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-4 text-[13px] font-bold text-[#1E1B4B] hover:bg-[#F8F9FA]"
              >
                Approve Shop in Admin Panel
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="text-[22px] font-extrabold text-[#111827]">
              Shop not found
            </h1>
            <p className="text-[14px] text-[#6B7280] leading-relaxed">
              No active shop matched slug{' '}
              <span className="font-mono font-semibold text-[#1E1B4B]">
                {businessSlug || '(empty)'}
              </span>
              . Open your Owner Dashboard to copy your shop&apos;s exact Live
              Queue &amp; Barber Chair link.
            </p>
            <div className="flex flex-col gap-2 pt-2">
              <Link
                to="/dashboard"
                className="inline-flex h-11 items-center justify-center rounded-xl bg-[#1E1B4B] px-4 text-[14px] font-bold text-[#FFFFFF] hover:bg-[#2E2A6E]"
              >
                Open Owner Dashboard
              </Link>
              <Link
                to="/r/crown-cuts-barber/queue"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-4 text-[13px] font-bold text-[#1E1B4B] hover:bg-[#F8F9FA]"
              >
                Preview Demo Barber Live Queue
              </Link>
            </div>
          </>
        )}
      </div>
    );
  }

  const roleDisplayLabel = staffSession
    ? (STAFF_ROLE_METADATA[staffSession.role]?.label ?? 'Barber')
    : '';
  const uploadedShopLogo = loadBusinessQRSettings(business).logoDataUrl;

  return (
    <div className="mx-auto w-full max-w-md rounded-3xl border border-[#303239] bg-[#101114] p-4 sm:p-5 text-[#F5F5F6] shadow-xl space-y-4 animate-fadeSlideUp">
      {/* Top Bar — CLIPAURA BARBER CHAIR MOBILE APP (#17181C) */}
      <header className="rounded-2xl border border-[#303239] bg-[#17181C] px-4 py-3.5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            {uploadedShopLogo ? (
              <img
                src={uploadedShopLogo}
                alt={`${business.name} logo`}
                className="h-9 w-9 shrink-0 rounded-xl border border-[#303239] bg-[#101114] object-contain p-0.5"
              />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D5A63C]/40 bg-[#202127] text-[#F2C45B]">
                <Scissors className="h-4 w-4" aria-hidden />
              </span>
            )}
            <div className="min-w-0">
              <h1 className="text-[13px] font-extrabold uppercase tracking-wider text-[#D5A63C]">
                CLIPAURA CHAIR APP
              </h1>
              <p className="truncate text-[12px] font-semibold text-[#B5B5BC]">
                {business.name}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <Link
              to={`/r/${business.slug}/queue`}
              className="rounded-xl border border-[#303239] bg-[#202127] px-3 py-1.5 text-[12px] font-bold text-[#F5F5F6] hover:border-[#D5A63C]"
            >
              Public Queue
            </Link>
            {verifiedPinHash && (
              <button
                type="button"
                onClick={handleLockSession}
                aria-label="Lock Barber Chair App"
                className="inline-flex h-9 items-center gap-1 rounded-xl border border-[#303239] bg-[#101114] px-2.5 text-[11px] font-bold text-[#F2C45B] hover:border-[#D5A63C] cursor-pointer"
              >
                <LogOut className="h-3.5 w-3.5" aria-hidden />
                <span>Lock</span>
              </button>
            )}
          </div>
        </div>

        {/* Active Personal Barber Identity Banner with small 1:1 avatar per Rule 6 */}
        {verifiedPinHash && staffSession && (
          <div
            role="status"
            className="flex items-center justify-between gap-2 rounded-xl border border-[#D5A63C]/40 bg-[#202127] px-3 py-2 text-[#F5F5F6]"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <img
                src={resolveBarberPortrait(staffSession.staffCode)}
                alt={staffSession.fullName}
                className="h-8 w-8 shrink-0 rounded-full object-cover border border-[#D5A63C]/60"
              />
              <p className="truncate text-[12.5px] font-bold">
                <span className="text-[#F2C45B]">
                  {staffSession.fullName} ({staffSession.staffCode})
                </span>{' '}
                • {roleDisplayLabel}
              </p>
            </div>
            <Lock className="h-3.5 w-3.5 shrink-0 text-[#B5B5BC]" aria-hidden />
          </div>
        )}
      </header>

      {/* Personal Barber PIN Login Screen vs Live Queue Chair Controller */}
      {!verifiedPinHash || !staffSession ? (
        <form
          onSubmit={(e) => void handleUnlockWithPin(e)}
          className="rounded-2xl border border-[#303239] bg-[#17181C] p-6 space-y-5"
        >
          <div className="text-center space-y-2">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-[#D5A63C]/40 bg-[#202127] text-[#F2C45B]">
              <KeyRound className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-[21px] font-extrabold tracking-tight text-[#F5F5F6]">
              Barber Chair Login
            </h2>
            <p className="text-[13px] text-[#B5B5BC]">
              Pick your Barber ID (e.g. <span className="font-mono font-bold text-[#F2C45B]">BAR-01</span>) and enter your personal 4–6 digit PIN for{' '}
              <strong className="text-[#F5F5F6]">{business.name}</strong>.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-4 py-3 text-[13px] font-semibold text-[#EF4444]"
            >
              <AlertCircle className="h-4 w-4 shrink-0" aria-hidden />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-4">
            {staffDirectory.length > 0 ? (
              <>
                <div className="space-y-1.5">
                  <label
                    htmlFor="barberRosterSelect"
                    className="block text-[11.5px] font-bold uppercase tracking-wider text-[#B5B5BC]"
                  >
                    Select Barber / Staff ID
                  </label>
                  <select
                    id="barberRosterSelect"
                    value={selectedStaffCode}
                    onChange={(e) => setSelectedStaffCode(e.target.value)}
                    className="block h-12 w-full rounded-xl border border-[#303239] bg-[#202127] px-3.5 text-[14px] font-bold text-[#F5F5F6] focus:border-[#D5A63C] focus:outline-none"
                  >
                    {staffDirectory.map((member) => (
                      <option key={member.id} value={member.staffCode}>
                        {member.fullName} ({member.staffCode}) —{' '}
                        {STAFF_ROLE_METADATA[member.role]?.label ?? member.role}
                      </option>
                    ))}
                    <option value="__manual__">
                      Enter Staff ID Manually / Shared PIN
                    </option>
                  </select>
                </div>

                {selectedStaffCode === '__manual__' && (
                  <div className="space-y-1.5">
                    <label
                      htmlFor="manualBarberCodeInput"
                      className="block text-[11.5px] font-bold uppercase tracking-wider text-[#B5B5BC]"
                    >
                      Barber Staff ID (Optional — e.g. BAR-01)
                    </label>
                    <input
                      id="manualBarberCodeInput"
                      type="text"
                      maxLength={20}
                      placeholder="e.g. BAR-01"
                      value={manualStaffCode}
                      onChange={(e) =>
                        setManualStaffCode(e.target.value.toUpperCase())
                      }
                      className="block h-11 w-full rounded-xl border border-[#303239] bg-[#202127] px-3.5 font-mono text-[14px] font-bold uppercase text-[#F2C45B] focus:border-[#D5A63C] focus:outline-none"
                    />
                  </div>
                )}
              </>
            ) : (
              <div className="space-y-1.5">
                <label
                  htmlFor="barberLegacyName"
                  className="block text-[11.5px] font-bold uppercase tracking-wider text-[#B5B5BC]"
                >
                  Barber Name / Chair
                </label>
                <input
                  id="barberLegacyName"
                  type="text"
                  maxLength={60}
                  placeholder="e.g. Arjun (Chair 1)"
                  value={legacyBarberLabel}
                  onChange={(e) => setLegacyBarberLabel(e.target.value)}
                  className="block h-11 w-full rounded-xl border border-[#303239] bg-[#202127] px-3.5 text-[14px] font-semibold text-[#F5F5F6] focus:border-[#D5A63C] focus:outline-none"
                />
              </div>
            )}

            <div className="space-y-1.5">
              <label
                htmlFor="barberPinInput"
                className="block text-[11.5px] font-bold uppercase tracking-wider text-[#B5B5BC]"
              >
                Personal 4–6 Digit PIN
              </label>
              <input
                id="barberPinInput"
                type="password"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="••••"
                value={pinInput}
                onChange={(e) =>
                  setPinInput(e.target.value.replace(/\D/g, '').slice(0, 6))
                }
                className="block h-14 w-full rounded-xl border border-[#303239] bg-[#202127] px-4 text-center font-mono text-[26px] font-extrabold tracking-[0.35em] text-[#F2C45B] focus:border-[#D5A63C] focus:outline-none"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full min-h-12 text-[15px] !bg-[#D5A63C] !text-[#101114] hover:!bg-[#F2C45B]"
            disabled={verifying || pinInput.trim().length < 4}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {verifying ? 'Verifying Barber PIN…' : 'Unlock Chair Queue'}
          </Button>
        </form>
      ) : (
        <BarberQueueManagerView
          business={business}
          isBusinessLive={
            business.status === 'active' && business.accountState === 'active'
          }
          mode="barber_staff"
          staffPinHash={verifiedPinHash}
          staffLabel={staffSession.staffLabel}
        />
      )}
    </div>
  );
}
