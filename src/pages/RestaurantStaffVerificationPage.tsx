import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  KeyRound,
  UtensilsCrossed,
  LogOut,
  Loader2,
  SearchX,
  AlertCircle,
} from 'lucide-react';
import type { Business } from '../types/business';
import type { RestaurantProfile, RestaurantTable } from '../types/restaurant';
import { businessRepository } from '../services/storage';
import {
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
  const [loading, setLoading] = useState(true);

  const [pinInput, setPinInput] = useState('');
  const [staffLabel, setStaffLabel] = useState('Floor Staff');
  const [verifiedPinHash, setVerifiedPinHash] = useState<string | null>(null);
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
          const [prof, tbls] = await Promise.all([
            businessRepository.getRestaurantProfile(biz.id),
            businessRepository.getRestaurantTables(biz.id),
          ]);
          setProfile(prof);
          setTables(tbls);
        } catch {
          // ignore if public staff tablet hasn't authenticated as owner
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

    setVerifying(true);
    try {
      const hashed = await hashStaffPin(business.slug, check.pin);
      await businessRepository.verifyRestaurantStaffPin({
        businessSlug: business.slug,
        staffPinHash: hashed,
      });
      setVerifiedPinHash(hashed);
      setPinInput('');
    } catch (err) {
      setAuthError((err as Error).message);
    } finally {
      setVerifying(false);
    }
  }

  if (loading) {
    return (
      <div
        role="status"
        className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-12 text-center shadow-2xs"
      >
        <Loader2
          className="mx-auto h-7 w-7 animate-spin text-[#244B40]"
          aria-hidden
        />
        <p className="mt-3 text-[15px] font-medium text-[#626B65]">
          Loading Staff Verification Console…
        </p>
      </div>
    );
  }

  if (!business) {
    return (
      <div
        role="alert"
        className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center shadow-2xs space-y-3"
      >
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#EEF3EC] text-[#244B40]">
          <SearchX className="h-6 w-6" aria-hidden />
        </div>
        <h1 className="text-[22px] font-semibold text-[#252B29]">
          Restaurant not found
        </h1>
        <p className="text-[14px] text-[#626B65]">
          Please check the restaurant URL and try again.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Staff Console Header */}
      <div className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 shadow-2xs flex flex-wrap items-center justify-between gap-3">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-[#EEF3EC] px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-[#244B40]">
            <UtensilsCrossed className="h-3 w-3" aria-hidden /> Staff Floor &amp; Verification Mode
          </span>
          <h1 className="mt-1 text-[22px] font-bold text-[#252B29]">
            {business.name}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Link
            to={`/r/${business.slug}/menu`}
            className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] px-3 py-1.5 text-[12px] font-semibold text-[#252B29] hover:border-[#244B40]"
          >
            Guest Menu
          </Link>
          {verifiedPinHash && (
            <button
              type="button"
              onClick={() => setVerifiedPinHash(null)}
              className="inline-flex items-center gap-1 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[12px] font-semibold text-[#252B29] hover:bg-[#F7F7F2] cursor-pointer"
            >
              <LogOut className="h-3.5 w-3.5" aria-hidden /> Lock Screen
            </button>
          )}
        </div>
      </div>

      {/* Staff PIN Unlock Gate vs. Live Floor & Verification Console */}
      {!verifiedPinHash ? (
        <form
          onSubmit={(e) => void handleUnlockWithPin(e)}
          className="rounded-3xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 sm:p-8 shadow-2xs space-y-5"
        >
          <div className="text-center space-y-1.5">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF3EC] text-[#244B40]">
              <KeyRound className="h-6 w-6" aria-hidden />
            </div>
            <h2 className="text-[20px] font-bold text-[#252B29]">
              Enter Staff Verification PIN
            </h2>
            <p className="text-[13px] text-[#626B65]">
              Enter the 4–6 digit Staff PIN set by the owner of {business.name} to access the table floor map, verify paid visits, and fulfill reward tickets.
            </p>
          </div>

          {authError && (
            <div
              role="alert"
              className="flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900"
            >
              <AlertCircle
                className="h-4 w-4 shrink-0 text-red-700"
                aria-hidden
              />
              <span>{authError}</span>
            </div>
          )}

          <div className="space-y-3">
            <div className="space-y-1">
              <label
                htmlFor="staffNameLabelInput"
                className="block text-[12px] font-semibold uppercase tracking-wider text-[#626B65]"
              >
                Your Staff Name / Station
              </label>
              <input
                id="staffNameLabelInput"
                type="text"
                maxLength={60}
                placeholder="e.g. Waiter Rahul or Cashier Desk"
                value={staffLabel}
                onChange={(e) => setStaffLabel(e.target.value)}
                className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
            </div>

            <div className="space-y-1">
              <label
                htmlFor="staffPinPadInput"
                className="block text-[12px] font-semibold uppercase tracking-wider text-[#626B65]"
              >
                4–6 Digit Staff PIN
              </label>
              <input
                id="staffPinPadInput"
                type="password"
                inputMode="numeric"
                required
                maxLength={6}
                placeholder="••••"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                className="block min-h-12 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-4 py-2.5 text-center font-mono text-[20px] font-bold tracking-widest text-[#252B29]"
              />
            </div>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={verifying || pinInput.trim().length < 4}
          >
            <KeyRound className="h-4 w-4" aria-hidden />
            {verifying ? 'Verifying PIN…' : 'Unlock Staff Floor Console'}
          </Button>
        </form>
      ) : (
        <RestaurantFloorAndStaffPanel
          business={business}
          profile={profile}
          tables={tables}
          mode="staff_portal"
          staffPinHash={verifiedPinHash}
          staffLabel={staffLabel.trim() || 'Floor Staff'}
        />
      )}
    </div>
  );
}
