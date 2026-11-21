import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Award,
  Ticket,
  KeyRound,
  RefreshCw,
  ExternalLink,
  BarChart3,
  QrCode,
  Users,
  Gamepad2,
  Trophy,
  Gift,
  Receipt,
  AlertCircle,
  Camera,
  CameraOff,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  RestaurantFloorAndAnalyticsPayload,
  RestaurantProfile,
  RestaurantTable,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  hashStaffPin,
  parseCustomerLoyaltyLookup,
  validateStaffPinFormat,
} from '../../utils/restaurantValidation';
import { Button } from '../common/Button';

interface NativeDetectedBarcode {
  rawValue?: string;
}

interface NativeBarcodeDetectorInstance {
  detect(source: HTMLVideoElement): Promise<NativeDetectedBarcode[]>;
}

type NativeBarcodeDetectorConstructor = new (options?: {
  formats?: string[];
}) => NativeBarcodeDetectorInstance;

interface Props {
  business: Business;
  profile: RestaurantProfile | null;
  tables: RestaurantTable[];
  mode: 'owner' | 'staff_portal';
  staffPinHash?: string | null;
  staffLabel?: string;
  onProfileUpdated?: (profile: RestaurantProfile) => void;
  onStatus?: (msg: string) => void;
  onError?: (err: string) => void;
}

export function RestaurantFloorAndStaffPanel({
  business,
  profile,
  tables,
  mode,
  staffPinHash,
  staffLabel = mode === 'owner' ? 'Owner' : 'Staff PIN',
  onProfileUpdated,
  onStatus,
  onError,
}: Props) {
  const [floorData, setFloorData] =
    useState<RestaurantFloorAndAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Staff PIN & Visit Cooldown config (Owner mode)
  const [newPin, setNewPin] = useState('');
  const [minHoursCooldown, setMinHoursCooldown] = useState<number>(
    profile?.minHoursBetweenVisitStars ?? 4,
  );
  const [savingSecurity, setSavingSecurity] = useState(false);

  // Verify Paid Visit (+Stars) form & Live Camera QR Scanner
  const [customerLookup, setCustomerLookup] = useState('');
  const [visitTableKey, setVisitTableKey] = useState('');
  const [awardingStars, setAwardingStars] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerFallbackNotice, setScannerFallbackNotice] = useState<
    string | null
  >(null);
  const [scannedTokenBadge, setScannedTokenBadge] = useState<string | null>(
    null,
  );
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<number | null>(null);

  const stopCameraScanner = useCallback(() => {
    if (scanIntervalRef.current !== null) {
      window.clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }
    if (mediaStreamRef.current) {
      for (const track of mediaStreamRef.current.getTracks()) {
        track.stop();
      }
      mediaStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setScannerOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      stopCameraScanner();
    };
  }, [stopCameraScanner]);

  async function handleToggleCameraScanner() {
    if (scannerOpen) {
      stopCameraScanner();
      return;
    }

    setScannerFallbackNotice(null);
    setScannedTokenBadge(null);

    const DetectorCtor = (
      typeof window !== 'undefined'
        ? (
            window as unknown as {
              BarcodeDetector?: NativeBarcodeDetectorConstructor;
            }
          ).BarcodeDetector
        : undefined
    );

    if (
      !DetectorCtor ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setScannerFallbackNotice(
        'Live QR camera scanning (BarcodeDetector) is not supported on this browser. Please enter the diner’s phone/email or paste their Loyalty QR token below.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' } },
        audio: false,
      });
      mediaStreamRef.current = stream;
      setScannerOpen(true);

      const detector = new DetectorCtor({ formats: ['qr_code'] });

      // Attach stream once video element mounts
      window.setTimeout(() => {
        if (videoRef.current && mediaStreamRef.current) {
          videoRef.current.srcObject = mediaStreamRef.current;
          void videoRef.current.play().catch(() => {
            // ignore autoplay gesture warning
          });
        }
      }, 60);

      scanIntervalRef.current = window.setInterval(() => {
        const videoEl = videoRef.current;
        if (!videoEl || videoEl.readyState < 2) return;

        void detector
          .detect(videoEl)
          .then((barcodes) => {
            if (!barcodes || barcodes.length === 0) return;
            const rawValue = (barcodes[0]?.rawValue ?? '').trim();
            if (!rawValue) return;

            const parsed = parseCustomerLoyaltyLookup(rawValue);
            if (
              parsed.mode === 'qr_token' &&
              parsed.tokenBusinessSlug &&
              parsed.tokenBusinessSlug !== business.slug.toLowerCase()
            ) {
              reportError(
                `Scanned Loyalty QR belongs to another restaurant ("${parsed.tokenBusinessSlug}").`,
              );
              stopCameraScanner();
              return;
            }

            setCustomerLookup(rawValue);
            setScannedTokenBadge(
              parsed.mode === 'qr_token'
                ? `Loyalty QR Pass Scanned ✓ (Diner ID: ${parsed.value})`
                : `QR Scanned ✓ (${parsed.value})`,
            );
            stopCameraScanner();
          })
          .catch(() => {
            // ignore transient frame decode errors
          });
      }, 350);
    } catch {
      stopCameraScanner();
      setScannerFallbackNotice(
        'Camera permission was denied or no camera was found (HTTPS is required on mobile phones). You can enter the diner’s phone/email or Loyalty token manually below.',
      );
    }
  }

  // Verify Reward Claim Code form
  const [claimCodeInput, setClaimCodeInput] = useState('');
  const [fulfillingClaim, setFulfillingClaim] = useState(false);

  function reportStatus(msg: string) {
    setLocalError(null);
    setLocalStatus(msg);
    onStatus?.(msg);
  }

  function reportError(err: string) {
    setLocalStatus(null);
    setLocalError(err);
    onError?.(err);
  }

  const refreshFloorData = useCallback(async () => {
    try {
      const payload = await businessRepository.getRestaurantFloorAndAnalytics({
        businessSlug: business.slug,
        staffPinHash: staffPinHash ?? null,
      });
      setFloorData(payload);
    } catch (err) {
      setLocalError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }, [business.slug, staffPinHash]);

  useEffect(() => {
    let mounted = true;
    async function pollFloor() {
      try {
        const payload = await businessRepository.getRestaurantFloorAndAnalytics({
          businessSlug: business.slug,
          staffPinHash: staffPinHash ?? null,
        });
        if (!mounted) return;
        setFloorData(payload);
      } catch (err) {
        if (!mounted) return;
        setLocalError((err as Error).message);
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    }
    void pollFloor();
    const timer = window.setInterval(() => {
      void pollFloor();
    }, 10000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [business.slug, staffPinHash]);

  async function handleSaveStaffPinAndCooldown(e: React.FormEvent) {
    e.preventDefault();
    if (!profile) return;

    setSavingSecurity(true);
    try {
      let nextHash: string | null | undefined = profile.staffPinHash ?? null;
      if (newPin.trim()) {
        const pinCheck = validateStaffPinFormat(newPin);
        if (!pinCheck.ok) {
          reportError(pinCheck.error);
          setSavingSecurity(false);
          return;
        }
        nextHash = await hashStaffPin(business.slug, pinCheck.pin);
      }

      const updated = await businessRepository.updateRestaurantProfile(
        business.id,
        {
          isEnabled: profile.isEnabled,
          currencyCode: profile.currencyCode,
          tagline: profile.tagline,
          gamesEnabled: profile.gamesEnabled,
          loyaltyEnabled: profile.loyaltyEnabled,
          staffPinHash: nextHash,
          minHoursBetweenVisitStars: minHoursCooldown,
        },
      );
      setNewPin('');
      onProfileUpdated?.(updated);
      reportStatus(
        newPin.trim()
          ? 'Updated Staff PIN (SHA-256 hashed) and visit cooldown rules.'
          : 'Updated visit star cooldown rules.',
      );
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setSavingSecurity(false);
    }
  }

  async function handleUpdateTableCall(
    callId: string,
    nextStatus: 'acknowledged' | 'resolved',
  ) {
    try {
      await businessRepository.updateRestaurantTableCallStatus({
        businessSlug: business.slug,
        callId,
        status: nextStatus,
        staffPinHash: staffPinHash ?? null,
      });
      await refreshFloorData();
      reportStatus(
        nextStatus === 'acknowledged'
          ? 'Table alert acknowledged.'
          : 'Table alert resolved.',
      );
    } catch (err) {
      reportError((err as Error).message);
    }
  }

  async function handleAwardVisitStars(e: React.FormEvent) {
    e.preventDefault();
    if (!customerLookup.trim()) return;
    setAwardingStars(true);
    try {
      const idemKey = `visit-${business.slug}-${crypto.randomUUID()}`;
      const res = await businessRepository.staffAwardVisitStars({
        businessSlug: business.slug,
        customerLookup: customerLookup.trim(),
        tableKey: visitTableKey || null,
        staffLabel,
        idempotencyKey: idemKey,
        staffPinHash: staffPinHash ?? null,
      });
      setCustomerLookup('');
      setScannedTokenBadge(null);
      await refreshFloorData();
      reportStatus(
        `Verified paid visit for ${res.customerName}! Awarded +${res.starsAwarded} Loyalty Star(s) (New balance: ${res.newLoyaltyStarsBalance} ★).`,
      );
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setAwardingStars(false);
    }
  }

  async function handleFulfillClaimCode(codeToFulfill: string) {
    const clean = codeToFulfill.trim().toUpperCase();
    if (!clean) return;
    setFulfillingClaim(true);
    try {
      const fulfilled = await businessRepository.staffFulfillRewardClaim({
        businessSlug: business.slug,
        claimCode: clean,
        staffLabel,
        staffPinHash: staffPinHash ?? null,
      });
      setClaimCodeInput('');
      await refreshFloorData();
      reportStatus(
        `Fulfilled reward "${fulfilled.rewardTitle || 'Reward'}" (Code: ${fulfilled.claimCode}) for ${fulfilled.customerName || 'Diner'}.`,
      );
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setFulfillingClaim(false);
    }
  }

  if (loading && !floorData) {
    return (
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-8 text-center">
        <p className="text-[14px] text-[#626B65]">
          Loading live floor &amp; verification console…
        </p>
      </div>
    );
  }

  const activeCalls = floorData?.activeTableCalls ?? [];
  const pendingClaims = floorData?.pendingRewardClaims ?? [];
  const analytics = floorData?.analytics ?? {
    qrScans: 0,
    checkedInDiners: 0,
    gamesPlayed: 0,
    gamePointsIssued: 0,
    verifiedPaidVisits: 0,
    loyaltyStarsIssued: 0,
    rewardsClaimed: 0,
    rewardsFulfilled: 0,
  };

  return (
    <div className="space-y-6">
      {localStatus && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC] px-4 py-3 text-[13px] font-semibold text-[#244B40]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{localStatus}</span>
        </div>
      )}
      {localError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-300 bg-red-50 px-4 py-3 text-[13px] font-medium text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{localError}</span>
        </div>
      )}

      {/* 1. OWNER ANALYTICS FUNNEL (Explicitly Separating QR Scans vs. Verified Paid Visits) */}
      {mode === 'owner' && (
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[18px] font-semibold text-[#252B29] flex items-center gap-2">
                <BarChart3 className="h-5 w-5 text-[#244B40]" aria-hidden />
                Restaurant Engagement &amp; Loyalty Funnel Analytics
              </h3>
              <p className="text-[13px] text-[#626B65] mt-0.5">
                QR scans and menu views are tracked separately from staff-verified paid dining visits.
              </p>
            </div>
            <button
              type="button"
              onClick={() => void refreshFloorData()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] px-3 py-1.5 text-[12px] font-semibold text-[#252B29] hover:border-[#244B40] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </button>
          </div>

          <div className="grid gap-3.5 sm:grid-cols-4">
            <div className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#626B65]">
                <QrCode className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                Public QR Scans
              </p>
              <p className="mt-1 text-[22px] font-bold text-[#252B29]">
                {analytics.qrScans}
              </p>
              <p className="text-[11px] text-[#626B65]">Unverified scans</p>
            </div>

            <div className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#626B65]">
                <Users className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                Checked-In Diners
              </p>
              <p className="mt-1 text-[22px] font-bold text-[#252B29]">
                {analytics.checkedInDiners}
              </p>
              <p className="text-[11px] text-[#626B65]">Saved profiles</p>
            </div>

            <div className="rounded-2xl border border-[#DDE4DC] bg-[#F7F7F2]/60 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#626B65]">
                <Gamepad2 className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                Games &amp; Points
              </p>
              <p className="mt-1 text-[22px] font-bold text-[#252B29]">
                {analytics.gamesPlayed}{' '}
                <span className="text-[13px] font-semibold text-[#244B40]">
                  ({analytics.gamePointsIssued} pts)
                </span>
              </p>
              <p className="text-[11px] text-[#626B65]">Completed sessions</p>
            </div>

            <div className="rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC]/70 p-4">
              <p className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#244B40]">
                <Award className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                Verified Paid Visits
              </p>
              <p className="mt-1 text-[22px] font-bold text-[#244B40]">
                {analytics.verifiedPaidVisits}{' '}
                <span className="text-[13px] font-semibold">
                  ({analytics.loyaltyStarsIssued} ★)
                </span>
              </p>
              <p className="text-[11px] text-[#244B40]">
                Rewards: {analytics.rewardsFulfilled}/{analytics.rewardsClaimed} fulfilled
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. RESTO DADDY-STYLE VISUAL TABLE FLOOR MAP & ACTIVE CALLS */}
      <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-[18px] font-semibold text-[#252B29] flex items-center gap-2">
              <BellRing className="h-5 w-5 text-[#244B40]" aria-hidden />
              Visual Table Floor Map &amp; Live Table Calls ({activeCalls.length} Active)
            </h3>
            <p className="text-[13px] text-[#626B65] mt-0.5">
              Color-coded floor view showing which tables have requested waiter assistance or their bill.
            </p>
          </div>
          {mode === 'owner' && (
            <a
              href={`/r/${business.slug}/staff`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-[#244B40] bg-[#EEF3EC]/60 px-3.5 py-2 text-[13px] font-semibold text-[#244B40] hover:bg-[#EEF3EC]"
            >
              Open Staff Tablet View (/r/{business.slug}/staff){' '}
              <ExternalLink className="h-3.5 w-3.5" aria-hidden />
            </a>
          )}
        </div>

        {/* Visual Floor Grid */}
        {tables.length === 0 ? (
          <p className="rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-6 text-center text-[13px] text-[#626B65]">
            No tables created yet. Add tables in the &ldquo;3. Tables &amp; QR Standees&rdquo; section to see your live floor map.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
            {tables.map((tbl) => {
              const call = activeCalls.find((c) => c.tableId === tbl.id);
              const isBillCall = call?.callType === 'ready_for_bill';
              const isOpen = call?.status === 'open';

              return (
                <div
                  key={tbl.id}
                  className={`rounded-2xl border p-4 transition-all space-y-2.5 ${
                    call
                      ? isOpen
                        ? 'border-amber-500 bg-[#FAF3DF] shadow-sm'
                        : 'border-[#244B40] bg-[#EEF3EC]'
                      : 'border-[#DDE4DC] bg-[#F7F7F2]/60'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[16px] font-bold text-[#252B29]">
                        {tbl.tableNumber}
                      </p>
                      {tbl.tableLabel && (
                        <p className="text-[11px] text-[#626B65]">
                          {tbl.tableLabel}
                        </p>
                      )}
                    </div>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                        call
                          ? isOpen
                            ? 'bg-amber-600 text-[#FFFFFF]'
                            : 'bg-[#244B40] text-[#FFFFFF]'
                          : 'bg-[#EEF3EC] text-[#244B40]'
                      }`}
                    >
                      {call
                        ? isBillCall
                          ? 'Bill Requested'
                          : 'Calling Waiter'
                        : 'Clear'}
                    </span>
                  </div>

                  {call && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {call.status === 'open' && (
                        <button
                          type="button"
                          onClick={() =>
                            void handleUpdateTableCall(call.id, 'acknowledged')
                          }
                          className="flex-1 rounded-xl border border-[#244B40] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] font-bold text-[#244B40] hover:bg-[#EEF3EC] cursor-pointer"
                        >
                          Acknowledge
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() =>
                          void handleUpdateTableCall(call.id, 'resolved')
                        }
                        className="flex-1 rounded-xl bg-[#244B40] px-2.5 py-1.5 text-[11px] font-bold text-[#FFFFFF] hover:bg-[#1C3B32] cursor-pointer"
                      >
                        Resolve ✓
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 3. STAFF VERIFICATION CONSOLE: VERIFY PAID VISIT (+STARS) & FULFILL REWARD CLAIM */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* LEFT: Verify Paid Visit & Award Loyalty Stars */}
        <form
          onSubmit={(e) => void handleAwardVisitStars(e)}
          className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-start justify-between gap-2.5">
            <div>
              <h3 className="text-[17px] font-semibold text-[#252B29] flex items-center gap-2">
                <Award className="h-5 w-5 text-[#244B40]" aria-hidden />
                Verify Paid Dining Visit (+Loyalty Stars)
              </h3>
              <p className="text-[12px] text-[#626B65] mt-0.5">
                Scan the diner&apos;s Loyalty QR pass with your camera or enter their saved phone/email to verify a paid visit and award Loyalty Stars.
              </p>
            </div>

            <button
              type="button"
              onClick={() => void handleToggleCameraScanner()}
              className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl border px-3.5 py-2 text-[12px] font-bold transition-colors cursor-pointer ${
                scannerOpen
                  ? 'border-red-300 bg-red-50 text-red-900 hover:bg-red-100'
                  : 'border-[#244B40] bg-[#EEF3EC] text-[#244B40] hover:bg-[#244B40] hover:text-[#FFFFFF]'
              }`}
            >
              {scannerOpen ? (
                <>
                  <CameraOff className="h-3.5 w-3.5" aria-hidden /> Close Camera
                </>
              ) : (
                <>
                  <Camera className="h-3.5 w-3.5" aria-hidden /> Scan Customer QR
                </>
              )}
            </button>
          </div>

          {/* Live Camera QR Viewfinder */}
          {scannerOpen && (
            <div className="overflow-hidden rounded-2xl border-2 border-[#244B40] bg-[#111827] p-3 text-center space-y-2">
              <video
                ref={videoRef}
                muted
                playsInline
                className="mx-auto h-52 w-full max-w-xs rounded-xl object-cover bg-black"
              />
              <p className="text-[12px] font-medium text-[#FAF3DF]">
                Point camera at the diner&apos;s personal Loyalty QR Pass…
              </p>
            </div>
          )}

          {scannerFallbackNotice && (
            <div
              role="status"
              className="rounded-xl border border-[#E4BD63] bg-[#FAF3DF] px-3.5 py-2.5 text-[12px] font-medium text-[#252B29]"
            >
              {scannerFallbackNotice}
            </div>
          )}

          {scannedTokenBadge && (
            <div
              role="status"
              className="flex items-center justify-between gap-2 rounded-xl border border-[#A8BFA5] bg-[#EEF3EC] px-3.5 py-2 text-[12px] font-semibold text-[#244B40]"
            >
              <span className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
                {scannedTokenBadge}
              </span>
              <button
                type="button"
                onClick={() => setScannedTokenBadge(null)}
                className="text-[11px] underline cursor-pointer"
              >
                Clear
              </button>
            </div>
          )}

          <div className="space-y-1.5">
            <label
              htmlFor="staffCustomerLookupInput"
              className="block text-[13px] font-semibold text-[#252B29]"
            >
              Diner Loyalty QR Token, Phone/Email, or ID
            </label>
            <input
              id="staffCustomerLookupInput"
              type="text"
              required
              placeholder="e.g. vitaran-loyalty://... or diner@example.com"
              value={customerLookup}
              onChange={(e) => {
                const val = e.target.value;
                setCustomerLookup(val);
                const parsed = parseCustomerLoyaltyLookup(val);
                if (parsed.mode === 'qr_token') {
                  setScannedTokenBadge(
                    `Loyalty QR Pass Detected ✓ (Diner ID: ${parsed.value})`,
                  );
                } else {
                  setScannedTokenBadge(null);
                }
              }}
              className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="staffVisitTableSelect"
              className="block text-[13px] font-semibold text-[#252B29]"
            >
              Table (Optional)
            </label>
            <select
              id="staffVisitTableSelect"
              value={visitTableKey}
              onChange={(e) => setVisitTableKey(e.target.value)}
              className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
            >
              <option value="">General / Counter Checkout</option>
              {tables.map((t) => (
                <option key={t.id} value={t.tableKey}>
                  {t.tableNumber}
                  {t.tableLabel ? ` (${t.tableLabel})` : ''}
                </option>
              ))}
            </select>
          </div>

          <Button
            type="submit"
            variant="primary"
            className="w-full"
            disabled={awardingStars || !customerLookup.trim()}
          >
            <Trophy className="h-4 w-4" aria-hidden />
            {awardingStars
              ? 'Verifying Visit…'
              : 'Verify Paid Visit & Award Stars'}
          </Button>
        </form>

        {/* RIGHT: Verify & Fulfill 6-Character Reward Claim Ticket */}
        <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
          <div>
            <h3 className="text-[17px] font-semibold text-[#252B29] flex items-center gap-2">
              <Ticket className="h-5 w-5 text-[#244B40]" aria-hidden />
              Verify 6-Character Reward Claim Ticket
            </h3>
            <p className="text-[12px] text-[#626B65] mt-0.5">
              Enter the 6-character Claim Code shown on the guest&apos;s phone to verify and fulfill their reward.
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleFulfillClaimCode(claimCodeInput);
            }}
            className="flex gap-2.5"
          >
            <input
              type="text"
              maxLength={6}
              placeholder="6-CHAR CODE (e.g. K7M4P9)"
              value={claimCodeInput}
              onChange={(e) => setClaimCodeInput(e.target.value.toUpperCase())}
              className="block min-h-11 flex-1 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 font-mono text-[15px] font-bold uppercase tracking-widest text-[#252B29]"
            />
            <Button
              type="submit"
              variant="primary"
              disabled={fulfillingClaim || claimCodeInput.trim().length !== 6}
            >
              <Gift className="h-4 w-4" aria-hidden />
              {fulfillingClaim ? 'Verifying…' : 'Mark Fulfilled'}
            </Button>
          </form>

          {pendingClaims.length > 0 && (
            <div className="space-y-2 border-t border-[#DDE4DC] pt-3">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
                Pending Claim Tickets ({pendingClaims.length})
              </p>
              <div className="space-y-2 max-h-44 overflow-y-auto">
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#E4BD63] bg-[#FAF3DF] px-3.5 py-2.5"
                  >
                    <div>
                      <p className="text-[13px] font-bold text-[#252B29]">
                        {claim.rewardTitle || 'Reward'} ·{' '}
                        <span className="font-mono text-[#244B40]">
                          {claim.claimCode}
                        </span>
                      </p>
                      <p className="text-[11px] text-[#626B65]">
                        Diner: {claim.customerName || 'Guest'} ({claim.starsSpent} ★)
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={fulfillingClaim}
                      onClick={() => void handleFulfillClaimCode(claim.claimCode)}
                      className="rounded-xl bg-[#244B40] px-3 py-1.5 text-[12px] font-bold text-[#FFFFFF] hover:bg-[#1C3B32] cursor-pointer"
                    >
                      Fulfill ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 4. OWNER STAFF PIN & VISIT COOLDOWN SETTINGS */}
      {mode === 'owner' && (
        <form
          onSubmit={(e) => void handleSaveStaffPinAndCooldown(e)}
          className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4"
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[17px] font-semibold text-[#252B29] flex items-center gap-2">
                <KeyRound className="h-5 w-5 text-[#244B40]" aria-hidden />
                Staff Verification PIN &amp; Visit Star Cooldown
              </h3>
              <p className="text-[13px] text-[#626B65] mt-0.5">
                Set a 4–6 digit Staff PIN so waiters or cashiers can access{' '}
                <code className="rounded bg-[#F7F7F2] px-1.5 py-0.5 font-mono text-[12px]">
                  /r/{business.slug}/staff
                </code>{' '}
                without needing your owner account password. The PIN is hashed with SHA-256 before saving.
              </p>
            </div>
            <span
              className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
                profile?.staffPinHash
                  ? 'bg-[#EEF3EC] text-[#244B40]'
                  : 'bg-[#FAF3DF] border border-[#E4BD63] text-[#252B29]'
              }`}
            >
              {profile?.staffPinHash ? 'Staff PIN Configured ✓' : 'No Staff PIN Set'}
            </span>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <label
                htmlFor="staffPinInput"
                className="block text-[13px] font-semibold text-[#252B29]"
              >
                {profile?.staffPinHash
                  ? 'New 4–6 Digit Staff PIN (Leave blank to keep current PIN)'
                  : 'Set 4–6 Digit Staff PIN (e.g. 2468)'}
              </label>
              <input
                id="staffPinInput"
                type="password"
                inputMode="numeric"
                maxLength={6}
                placeholder="Enter 4 to 6 digits"
                value={newPin}
                onChange={(e) => setNewPin(e.target.value)}
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="visitCooldownHoursInput"
                className="block text-[13px] font-semibold text-[#252B29]"
              >
                Min Hours Between Visit Stars (Same Diner)
              </label>
              <input
                id="visitCooldownHoursInput"
                type="number"
                min={0}
                max={168}
                value={minHoursCooldown}
                onChange={(e) =>
                  setMinHoursCooldown(
                    Math.max(0, Number.parseInt(e.target.value || '0', 10)),
                  )
                }
                className="block min-h-10 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29]"
              />
              <p className="text-[11px] text-[#626B65]">
                Prevents accidental double-awarding on the same meal (default 4 hours).
              </p>
            </div>
          </div>

          <div className="flex justify-end">
            <Button type="submit" variant="primary" disabled={savingSecurity}>
              <Receipt className="h-4 w-4" aria-hidden />
              {savingSecurity
                ? 'Saving…'
                : 'Save Staff PIN & Visit Cooldown'}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
