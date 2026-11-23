import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BellRing,
  CheckCircle2,
  Ticket,
  RefreshCw,
  AlertCircle,
  Camera,
  CameraOff,
  Search,
  ChefHat,
  Star,
  LayoutGrid,
  ShieldCheck,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  RestaurantFloorAndAnalyticsPayload,
  RestaurantProfile,
  RestaurantTable,
  RestaurantTableOrderStatus,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import { parseCustomerLoyaltyLookup } from '../../utils/restaurantValidation';

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

function getShortTableCode(tableNumber: string, index: number): string {
  const trimmed = tableNumber.trim();
  const numMatch = trimmed.match(/(\d+)/);
  if (numMatch) {
    return `T${Number.parseInt(numMatch[1], 10)}`;
  }
  if (trimmed.length <= 4) {
    return trimmed.toUpperCase();
  }
  return `T${index + 1}`;
}

export function RestaurantFloorAndStaffPanel({
  business,
  profile,
  tables,
  staffPinHash,
  staffLabel = 'Floor Staff',
  onStatus,
  onError,
}: Props) {
  const [floorData, setFloorData] =
    useState<RestaurantFloorAndAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // Clean 3-tab Mobile Waiter Navigation
  const [activeTab, setActiveTab] = useState<'scan' | 'orders' | 'tables'>(
    'scan',
  );

  // Unified Search / Lookup Input (Phone, Email, Loyalty QR Token, or 6-Digit Claim Code)
  const [unifiedLookup, setUnifiedLookup] = useState('');
  const [selectedTableKey, setSelectedTableKey] = useState<string>('');
  const [processingLookup, setProcessingLookup] = useState(false);

  // Live Camera QR Scanner state
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
    }, 8000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [business.slug, staffPinHash]);

  async function handleToggleCameraScanner() {
    if (scannerOpen) {
      stopCameraScanner();
      return;
    }

    setScannerFallbackNotice(null);
    setScannedTokenBadge(null);

    const DetectorCtor =
      typeof window !== 'undefined'
        ? (
            window as unknown as {
              BarcodeDetector?: NativeBarcodeDetectorConstructor;
            }
          ).BarcodeDetector
        : undefined;

    if (
      !DetectorCtor ||
      typeof navigator === 'undefined' ||
      !navigator.mediaDevices?.getUserMedia
    ) {
      setScannerFallbackNotice(
        'Live QR camera scanning (BarcodeDetector) is not available on this device. Enter the guest’s Phone, Email, or 6-Digit Claim Code below.',
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

            setUnifiedLookup(rawValue);
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
        'Camera permission was denied or no camera was found. Enter the guest’s Phone, Email, or 6-Digit Claim Code below.',
      );
    }
  }

  async function handleUnifiedVerify(e: React.FormEvent) {
    e.preventDefault();
    const raw = unifiedLookup.trim();
    if (!raw) return;

    setProcessingLookup(true);
    setLocalError(null);

    try {
      const upper = raw.toUpperCase();
      const pendingClaims = floorData?.pendingRewardClaims ?? [];
      const matchesPendingClaim = pendingClaims.some(
        (c) => c.claimCode.toUpperCase() === upper,
      );
      const looksLikeSixCharClaimCode =
        /^[A-Z0-9]{6}$/.test(upper) &&
        !raw.includes('@') &&
        !raw.startsWith('vitaran-loyalty://');

      if (matchesPendingClaim || looksLikeSixCharClaimCode) {
        try {
          const fulfilled = await businessRepository.staffFulfillRewardClaim({
            businessSlug: business.slug,
            claimCode: upper,
            staffLabel,
            staffPinHash: staffPinHash ?? null,
          });
          setUnifiedLookup('');
          setScannedTokenBadge(null);
          await refreshFloorData();
          reportStatus(
            `Fulfilled reward "${fulfilled.rewardTitle || 'Reward'}" (Code: ${fulfilled.claimCode}) for ${fulfilled.customerName || 'Guest'}!`,
          );
          return;
        } catch (claimErr) {
          // If it wasn't a known claim code and not explicitly a pending claim, only throw if it didn't match a customer either
          if (matchesPendingClaim) {
            throw claimErr;
          }
        }
      }

      // Otherwise treat as Customer Loyalty QR token, phone, email, or customer ID to award visit stars
      const idemKey = `visit-${business.slug}-${crypto.randomUUID()}`;
      const res = await businessRepository.staffAwardVisitStars({
        businessSlug: business.slug,
        customerLookup: raw,
        tableKey: selectedTableKey || null,
        staffLabel,
        idempotencyKey: idemKey,
        staffPinHash: staffPinHash ?? null,
      });
      setUnifiedLookup('');
      setScannedTokenBadge(null);
      await refreshFloorData();
      reportStatus(
        `Verified paid bill for ${res.customerName}! Awarded +${res.starsAwarded} ★ (New balance: ${res.newLoyaltyStarsBalance} ★) • Verified by ${res.verifiedByLabel}.`,
      );
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setProcessingLookup(false);
    }
  }

  async function handleFulfillClaimCodeDirect(codeToFulfill: string) {
    const clean = codeToFulfill.trim().toUpperCase();
    if (!clean) return;
    setProcessingLookup(true);
    try {
      const fulfilled = await businessRepository.staffFulfillRewardClaim({
        businessSlug: business.slug,
        claimCode: clean,
        staffLabel,
        staffPinHash: staffPinHash ?? null,
      });
      await refreshFloorData();
      reportStatus(
        `Fulfilled "${fulfilled.rewardTitle || 'Reward'}" (${fulfilled.claimCode}) for ${fulfilled.customerName || 'Guest'}!`,
      );
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setProcessingLookup(false);
    }
  }

  async function handleResolveTableCall(callId: string) {
    try {
      await businessRepository.updateRestaurantTableCallStatus({
        businessSlug: business.slug,
        callId,
        status: 'resolved',
        staffPinHash: staffPinHash ?? null,
      });
      await refreshFloorData();
      reportStatus('Table call resolved ✓');
    } catch (err) {
      reportError((err as Error).message);
    }
  }

  async function handleUpdateTableOrder(
    orderId: string,
    nextStatus: RestaurantTableOrderStatus,
  ) {
    setProcessingLookup(true);
    try {
      await businessRepository.updateTableOrderStatus({
        businessSlug: business.slug,
        orderId,
        status: nextStatus,
        staffLabel,
        staffPinHash: staffPinHash ?? null,
      });
      await refreshFloorData();
      const statusLabels: Record<RestaurantTableOrderStatus, string> = {
        pending_approval: 'Moved to Pending.',
        approved_for_kitchen: 'Approved → Sent to Chef Kitchen Queue!',
        preparing: 'Kitchen started preparing order.',
        ready: 'Order marked Ready to Serve!',
        served: 'Order marked Served ✓',
        cancelled: 'Order cancelled.',
      };
      reportStatus(statusLabels[nextStatus]);
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setProcessingLookup(false);
    }
  }

  if (loading && !floorData) {
    return (
      <div className="bistro-card p-10 text-center">
        <p className="text-[14px] font-medium text-[#6B7280]">
          Loading Waiter Floor View…
        </p>
      </div>
    );
  }

  const activeCalls = floorData?.activeTableCalls ?? [];
  const pendingClaims = floorData?.pendingRewardClaims ?? [];
  const tableOrders = floorData?.tableOrders ?? [];
  const pendingOrderCount = tableOrders.filter(
    (o) => o.status === 'pending_approval',
  ).length;
  const orderingActive =
    Boolean(floorData?.tableOrderingEnabled) ||
    Boolean(profile?.tableOrderingEnabled) ||
    tableOrders.length > 0;

  const trimmedLookup = unifiedLookup.trim();
  const isSixCharClaimInput =
    /^[A-Z0-9]{6}$/.test(trimmedLookup.toUpperCase()) &&
    !trimmedLookup.includes('@') &&
    !trimmedLookup.toLowerCase().startsWith('vitaran-loyalty://');

  return (
    <div className="space-y-4 animate-fadeSlideUp">
      {/* Status & Error Toasts */}
      {localStatus && (
        <div
          role="status"
          className="flex items-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-[#059669]"
        >
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          <span>{localStatus}</span>
        </div>
      )}
      {localError && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] font-semibold text-red-900"
        >
          <AlertCircle className="h-4 w-4 shrink-0 text-red-700" aria-hidden />
          <span>{localError}</span>
        </div>
      )}

      {/* 3-TAB MOBILE WAITER NAVIGATION BAR */}
      <nav
        aria-label="Waiter Floor Views"
        className="bistro-card p-1.5 grid grid-cols-3 gap-1.5"
      >
        <button
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-[11.5px] font-extrabold transition-all cursor-pointer ${
            activeTab === 'scan'
              ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
              : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
          }`}
        >
          <Camera
            className={`h-4 w-4 ${
              activeTab === 'scan' ? 'text-[#D2DB76]' : 'text-[#1E1B4B]'
            }`}
            aria-hidden
          />
          <span>1. Scan &amp; Stars</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-[11.5px] font-extrabold transition-all cursor-pointer ${
            activeTab === 'orders'
              ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
              : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
          }`}
        >
          <ChefHat
            className={`h-4 w-4 ${
              activeTab === 'orders' ? 'text-[#D2DB76]' : 'text-[#1E1B4B]'
            }`}
            aria-hidden
          />
          <span>2. Orders → Chef</span>
          {pendingOrderCount > 0 && (
            <span className="absolute top-1.5 right-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-extrabold text-[#FFFFFF] tabular-nums">
              {pendingOrderCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tables')}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-2 text-[11.5px] font-extrabold transition-all cursor-pointer ${
            activeTab === 'tables'
              ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
              : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
          }`}
        >
          <LayoutGrid
            className={`h-4 w-4 ${
              activeTab === 'tables' ? 'text-[#D2DB76]' : 'text-[#1E1B4B]'
            }`}
            aria-hidden
          />
          <span>3. Live Tables</span>
          {activeCalls.length > 0 && (
            <span className="absolute top-1.5 right-1.5 inline-flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#D97706] px-1 text-[10px] font-extrabold text-[#FFFFFF] tabular-nums">
              {activeCalls.length}
            </span>
          )}
        </button>
      </nav>

      {/* =====================================================================
          TAB 1 — SCAN & AWARD LOYALTY STARS (APPROVAL 2: PAID BILL → +1 STAR)
         ===================================================================== */}
      {activeTab === 'scan' && (
        <div className="space-y-4 animate-fadeSlideUp">
          <div className="bistro-card p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase tracking-wider text-[#059669]">
                Approval 2 • Paid Bill → +1 Star
              </span>
              {selectedTableKey && (
                <span className="rounded-full bg-[#D2DB76]/60 px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#1E1B4B]">
                  Table: {selectedTableKey}
                </span>
              )}
            </div>

            {/* Giant Full-Width Midnight Navy Button: SCAN CUSTOMER LOYALTY QR */}
            <button
              type="button"
              onClick={() => void handleToggleCameraScanner()}
              className={`flex min-h-14 w-full items-center justify-center gap-3 rounded-2xl px-5 py-4 text-[14px] font-extrabold uppercase tracking-wider shadow-md transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                scannerOpen
                  ? 'bg-red-700 text-[#FFFFFF]'
                  : 'bg-[#1E1B4B] text-[#FFFFFF] hover:bg-[#2E2A6E]'
              }`}
            >
              {scannerOpen ? (
                <>
                  <CameraOff className="h-5 w-5 text-[#D2DB76]" aria-hidden />
                  <span>CLOSE CAMERA SCANNER</span>
                </>
              ) : (
                <>
                  <Camera className="h-5 w-5 text-[#D2DB76]" aria-hidden />
                  <span>SCAN CUSTOMER LOYALTY QR</span>
                </>
              )}
            </button>

            {/* Live Camera Viewfinder */}
            {scannerOpen && (
              <div className="overflow-hidden rounded-2xl border-2 border-[#1E1B4B] bg-[#111827] p-3 text-center space-y-2 animate-fadeSlideUp">
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  className="mx-auto h-56 w-full max-w-xs rounded-xl object-cover bg-black"
                />
                <p className="text-[12px] font-semibold text-[#D2DB76]">
                  Point camera at the guest&apos;s personal Loyalty QR Pass…
                </p>
              </div>
            )}

            {scannerFallbackNotice && (
              <div
                role="status"
                className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-[12px] font-semibold text-[#D97706]"
              >
                {scannerFallbackNotice}
              </div>
            )}

            {scannedTokenBadge && (
              <div
                role="status"
                className="flex items-center justify-between gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-[12px] font-bold text-[#059669]"
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

            {/* Step 2: Confirm Paid Bill & Award +1 Star (or Fulfill 6-Char Ticket) */}
            <form
              onSubmit={(e) => void handleUnifiedVerify(e)}
              className="space-y-2.5 pt-1"
            >
              <div className="relative flex items-center rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] px-3 focus-within:border-[#1E1B4B] focus-within:bg-[#FFFFFF]">
                <Search
                  className="h-4 w-4 shrink-0 text-[#6B7280]"
                  aria-hidden
                />
                <input
                  type="text"
                  required
                  aria-label="Enter Phone, Email, Loyalty QR Token, or 6-Digit Claim Code"
                  placeholder="Guest Phone, Loyalty QR Token, or 6-Char Ticket…"
                  value={unifiedLookup}
                  onChange={(e) => {
                    const val = e.target.value;
                    setUnifiedLookup(val);
                    const parsed = parseCustomerLoyaltyLookup(val);
                    if (parsed.mode === 'qr_token') {
                      setScannedTokenBadge(
                        `Loyalty QR Pass Detected ✓ (Diner ID: ${parsed.value})`,
                      );
                    } else {
                      setScannedTokenBadge(null);
                    }
                  }}
                  className="h-11 w-full bg-transparent pl-2.5 text-[14px] font-semibold text-[#111827] placeholder:text-[#6B7280] focus:outline-none"
                />
              </div>

              <button
                type="submit"
                disabled={processingLookup || !trimmedLookup}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#059669] px-4 py-3 text-[13.5px] font-extrabold text-[#FFFFFF] shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                {isSixCharClaimInput ? (
                  <>
                    <Ticket className="h-4 w-4" aria-hidden />
                    <span>
                      {processingLookup
                        ? 'Fulfilling Ticket…'
                        : 'Fulfill 6-Char Reward Ticket ✓'}
                    </span>
                  </>
                ) : (
                  <>
                    <Star
                      className="h-4 w-4 text-[#D2DB76] fill-[#D2DB76]"
                      aria-hidden
                    />
                    <span>
                      {processingLookup
                        ? 'Verifying Paid Bill…'
                        : 'Confirm Paid Bill & Award +1 Star'}
                    </span>
                  </>
                )}
              </button>

              <p className="flex items-center justify-center gap-1.5 text-[11.5px] font-semibold text-[#6B7280]">
                <ShieldCheck
                  className="h-3.5 w-3.5 text-[#1E1B4B]"
                  aria-hidden
                />
                <span>
                  Audit log records:{' '}
                  <strong className="text-[#111827]">
                    Verified by {staffLabel}
                  </strong>
                </span>
              </p>
            </form>
          </div>

          {/* Pending 6-Character Reward Tickets Strip (1-Tap Fulfill) */}
          {pendingClaims.length > 0 && (
            <div className="bistro-card p-4 space-y-2.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
                <Ticket className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
                Pending Reward Claim Tickets ({pendingClaims.length})
              </p>
              <div className="space-y-2">
                {pendingClaims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between gap-2 rounded-xl border border-[#D2DB76] bg-[#D2DB76]/25 px-3.5 py-2.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[13px] font-extrabold text-[#111827]">
                        {claim.rewardTitle || 'Reward'} •{' '}
                        <span className="font-mono text-[#1E1B4B]">
                          {claim.claimCode}
                        </span>
                      </p>
                      <p className="text-[11px] font-medium text-[#6B7280]">
                        {claim.customerName || 'Guest'} ({claim.starsSpent} ★)
                      </p>
                    </div>
                    <button
                      type="button"
                      disabled={processingLookup}
                      onClick={() =>
                        void handleFulfillClaimCodeDirect(claim.claimCode)
                      }
                      className="shrink-0 rounded-xl bg-[#1E1B4B] px-3.5 py-1.5 text-[12px] font-extrabold text-[#FFFFFF] active:scale-[0.98] transition-all cursor-pointer"
                    >
                      Fulfill ✓
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2 — APPROVE ORDERS → CHEF (APPROVAL 1: ORDER → CHEF)
         ===================================================================== */}
      {activeTab === 'orders' && (
        <div className="bistro-card p-4 space-y-3.5 animate-fadeSlideUp">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1E1B4B] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#D2DB76]">
                Approval 1 • Order → Chef
              </span>
              <h2 className="mt-1 text-[15px] font-extrabold text-[#111827] flex items-center gap-1.5">
                <ChefHat className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Incoming Orders &amp; Kitchen Queue ({tableOrders.length})
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void refreshFloorData()}
              className="inline-flex h-8 items-center gap-1 rounded-lg border border-[#1E1B4B]/15 px-2.5 text-[11px] font-bold text-[#1E1B4B] cursor-pointer"
            >
              <RefreshCw className="h-3 w-3" aria-hidden /> Sync
            </button>
          </div>

          {!orderingActive ? (
            <div className="rounded-xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-6 text-center space-y-1.5">
              <p className="text-[13.5px] font-bold text-[#111827]">
                Customer Phone Ordering is currently OFF
              </p>
              <p className="text-[12px] text-[#6B7280]">
                Guests are browsing a view-only menu. Ask the owner to toggle Phone Ordering ON to receive table orders here.
              </p>
            </div>
          ) : tableOrders.length === 0 ? (
            <div className="rounded-xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-6 text-center space-y-1">
              <p className="text-[13.5px] font-bold text-[#111827]">
                No pending table orders
              </p>
              <p className="text-[12px] text-[#6B7280]">
                New guest orders appear here automatically for 1-tap approval to Chef.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {tableOrders.map((ord) => {
                const itemsLine = ord.items
                  .map((i) => `${i.quantity}× ${i.name}`)
                  .join(', ');
                const note = ord.items.find((i) => i.notes)?.notes;

                return (
                  <div
                    key={ord.id}
                    className={`rounded-2xl border p-3.5 space-y-2.5 ${
                      ord.status === 'pending_approval'
                        ? 'border-amber-300 bg-amber-50/70'
                        : ord.status === 'approved_for_kitchen'
                          ? 'border-[#1E1B4B]/20 bg-[#F8F9FA]'
                          : 'border-emerald-200 bg-emerald-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[14px] font-extrabold text-[#111827]">
                        {ord.tableNumber || 'Table Order'}
                        {ord.guestName ? ` • ${ord.guestName}` : ''}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          ord.status === 'pending_approval'
                            ? 'bg-[#D97706] text-[#FFFFFF]'
                            : ord.status === 'approved_for_kitchen'
                              ? 'bg-[#1E1B4B] text-[#D2DB76]'
                              : 'bg-[#059669] text-[#FFFFFF]'
                        }`}
                      >
                        {ord.status === 'pending_approval'
                          ? 'Pending Approval'
                          : ord.status === 'approved_for_kitchen'
                            ? 'Sent to Chef'
                            : 'Preparing'}
                      </span>
                    </div>

                    <p className="text-[13px] font-semibold text-[#111827]">
                      {itemsLine}
                    </p>
                    {note && (
                      <p className="text-[11.5px] italic text-[#D97706]">
                        Note: &ldquo;{note}&rdquo;
                      </p>
                    )}
                    {ord.approvedBy && (
                      <p className="text-[11px] font-semibold text-[#6B7280]">
                        Approved by:{' '}
                        <strong className="text-[#1E1B4B]">
                          {ord.approvedBy}
                        </strong>
                      </p>
                    )}

                    <div className="flex items-center gap-2 pt-0.5">
                      {ord.status === 'pending_approval' && (
                        <>
                          <button
                            type="button"
                            disabled={processingLookup}
                            onClick={() =>
                              void handleUpdateTableOrder(
                                ord.id,
                                'approved_for_kitchen',
                              )
                            }
                            className="flex-1 rounded-xl bg-[#1E1B4B] py-2.5 text-[12px] font-extrabold text-[#FFFFFF] active:scale-[0.98] transition-all cursor-pointer"
                          >
                            Approve Order → Send to Chef
                          </button>
                          <button
                            type="button"
                            disabled={processingLookup}
                            onClick={() =>
                              void handleUpdateTableOrder(ord.id, 'cancelled')
                            }
                            className="rounded-xl border border-red-200 bg-[#FFFFFF] px-3 py-2.5 text-[12px] font-bold text-red-700 cursor-pointer"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {ord.status === 'approved_for_kitchen' && (
                        <button
                          type="button"
                          disabled={processingLookup}
                          onClick={() =>
                            void handleUpdateTableOrder(ord.id, 'preparing')
                          }
                          className="flex-1 rounded-xl bg-[#1E1B4B] py-2.5 text-[12px] font-extrabold text-[#FFFFFF] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Chef: Start Preparing
                        </button>
                      )}
                      {ord.status === 'preparing' && (
                        <button
                          type="button"
                          disabled={processingLookup}
                          onClick={() =>
                            void handleUpdateTableOrder(ord.id, 'served')
                          }
                          className="flex-1 rounded-xl bg-[#059669] py-2.5 text-[12px] font-extrabold text-[#FFFFFF] active:scale-[0.98] transition-all cursor-pointer"
                        >
                          Mark Served ✓
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3 — LIVE 2-COLUMN VISUAL TABLE MAP (T1–T6)
         ===================================================================== */}
      {activeTab === 'tables' && (
        <div className="space-y-3 animate-fadeSlideUp">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#111827]">
                LIVE TABLE MAP
              </h2>
              {selectedTableKey && (
                <span className="rounded-full bg-[#D2DB76]/60 px-2.5 py-0.5 text-[11px] font-extrabold text-[#1E1B4B]">
                  Tagged: {selectedTableKey}
                </span>
              )}
            </div>
            <button
              type="button"
              onClick={() => void refreshFloorData()}
              className="inline-flex items-center gap-1 text-[12px] font-bold text-[#6B7280] hover:text-[#111827] cursor-pointer"
            >
              <RefreshCw className="h-3.5 w-3.5" aria-hidden /> Refresh
            </button>
          </div>

          {tables.length === 0 ? (
            <div className="bistro-card p-8 text-center text-[13px] text-[#6B7280]">
              No tables configured yet. Add tables in the Owner Workspace under &ldquo;Tables &amp; QRs&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3.5">
              {tables.map((tbl, idx) => {
                const call = activeCalls.find((c) => c.tableId === tbl.id);
                const isBillCall = call?.callType === 'ready_for_bill';
                const shortCode = getShortTableCode(tbl.tableNumber, idx);
                const isSelected = selectedTableKey === tbl.tableKey;

                if (call) {
                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => void handleResolveTableCall(call.id)}
                      className="group relative flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-[#D97706] bg-[#E5A93C] p-4 text-center text-[#111827] shadow-md transition-all duration-150 active:scale-[0.98] cursor-pointer"
                    >
                      <span className="absolute top-3 right-3 flex h-3 w-3">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#1E1B4B] opacity-75" />
                        <span className="relative inline-flex h-3 w-3 rounded-full bg-[#1E1B4B]" />
                      </span>

                      <span className="text-[32px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums">
                        {shortCode}
                      </span>

                      <span className="inline-flex items-center gap-1 rounded-full bg-[#111827]/15 px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider text-[#111827]">
                        {isBillCall ? 'BILL REQUESTED' : 'WAITER CALLED'}
                        <BellRing className="h-3 w-3" aria-hidden />
                      </span>

                      <span className="text-[11px] font-bold text-[#111827]/80 underline">
                        Tap to Resolve ✓
                      </span>
                    </button>
                  );
                }

                return (
                  <button
                    key={tbl.id}
                    type="button"
                    onClick={() =>
                      setSelectedTableKey((prev) =>
                        prev === tbl.tableKey ? '' : tbl.tableKey,
                      )
                    }
                    className={`flex aspect-square flex-col items-center justify-center gap-2.5 rounded-2xl border bg-[#FFFFFF] p-4 text-center shadow-2xs transition-all duration-150 active:scale-[0.98] cursor-pointer ${
                      isSelected
                        ? 'border-2 border-[#1E1B4B] ring-2 ring-[#D2DB76]'
                        : 'border-[#1E1B4B]/10 hover:border-[#1E1B4B]/40'
                    }`}
                  >
                    <span className="text-[32px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums">
                      {shortCode}
                    </span>

                    <span
                      className={`rounded-full px-3 py-1 text-[11px] font-extrabold uppercase tracking-wider ${
                        isSelected
                          ? 'bg-[#D2DB76] text-[#1E1B4B]'
                          : 'bg-emerald-50 text-[#059669] border border-emerald-200'
                      }`}
                    >
                      {isSelected ? 'TAGGED FOR SCAN' : 'AVAILABLE'}
                    </span>

                    <span className="text-[11px] font-medium text-[#6B7280] truncate max-w-full">
                      {tbl.tableNumber}
                      {tbl.tableLabel ? ` • ${tbl.tableLabel}` : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
