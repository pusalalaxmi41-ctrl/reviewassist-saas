import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  UtensilsCrossed,
  Volume2,
  VolumeX,
  Plus,
  Minus,
  Send,
  ClipboardCheck,
  Hand,
  BedDouble,
  Clock,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  PublicRestaurantMenuPayload,
  RestaurantCurrencyCode,
  RestaurantFloorAndAnalyticsPayload,
  RestaurantMenuCategory,
  RestaurantMenuItem,
  RestaurantProfile,
  RestaurantTable,
  RestaurantTableCall,
  RestaurantTableOrderStatus,
} from '../../types/restaurant';
import { businessRepository } from '../../services/storage';
import {
  DIETARY_TAG_METADATA,
  formatPriceFromPaise,
  parseCustomerLoyaltyLookup,
} from '../../utils/restaurantValidation';
import {
  formatElapsedOccupancy,
  ORDER_SOURCE_METADATA,
  speakHospitalityAlert,
  TABLE_CALL_TYPE_METADATA,
} from '../../utils/hospitalityHelpers';

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
  staffCode?: string | null;
  staffName?: string | null;
  onProfileUpdated?: (profile: RestaurantProfile) => void;
  onStatus?: (msg: string) => void;
  onError?: (err: string) => void;
}

function computeOrderTotalPaise(
  items: ReadonlyArray<{ pricePaise: number; quantity: number }>,
  packagingPaise?: number,
): number {
  return (
    items.reduce((sum, item) => sum + item.pricePaise * item.quantity, 0) +
    (packagingPaise ?? 0)
  );
}

function getShortTableCode(
  tableNumber: string,
  index: number,
  locationType?: 'table' | 'room',
): string {
  const trimmed = tableNumber.trim();
  const numMatch = trimmed.match(/(\d+)/);
  const prefix = locationType === 'room' ? 'R' : 'T';
  if (numMatch) {
    return `${prefix}${Number.parseInt(numMatch[1], 10)}`;
  }
  if (trimmed.length <= 4) {
    return trimmed.toUpperCase();
  }
  return `${prefix}${index + 1}`;
}

function matchesLoggedInWaiter(
  assignedStaffLabel: string | null | undefined,
  staffLabel: string,
  staffCode?: string | null,
  staffName?: string | null,
): boolean {
  const assigned = (assignedStaffLabel ?? '').trim().toLowerCase();
  if (!assigned) return false;

  const cleanCode = (staffCode ?? '').trim().toLowerCase();
  if (cleanCode && cleanCode !== 'staff' && assigned.includes(cleanCode)) {
    return true;
  }

  const cleanLabel = staffLabel.trim().toLowerCase();
  if (cleanLabel && cleanLabel !== 'floor staff' && assigned.includes(cleanLabel)) {
    return true;
  }

  const cleanName = (staffName ?? '').trim().toLowerCase();
  if (
    cleanName &&
    cleanName.length >= 2 &&
    cleanName !== 'staff' &&
    cleanName !== 'floor staff' &&
    assigned.includes(cleanName)
  ) {
    return true;
  }

  return false;
}

export function RestaurantFloorAndStaffPanel({
  business,
  profile,
  tables,
  staffPinHash,
  staffLabel = 'Floor Staff',
  staffCode,
  staffName,
  onStatus,
  onError,
}: Props) {
  const [floorData, setFloorData] =
    useState<RestaurantFloorAndAnalyticsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [localStatus, setLocalStatus] = useState<string | null>(null);
  const [localError, setLocalError] = useState<string | null>(null);

  // 4-Tab Waiter Mobile Navigation (Default to Take Order so waiter can serve immediately)
  const [activeTab, setActiveTab] = useState<
    'take_order' | 'orders' | 'tables' | 'scan'
  >('take_order');

  // Voice Alert toggle for personal assigned notifications & kitchen-ready callouts
  const [voiceAlertsOn, setVoiceAlertsOn] = useState(true);
  const announcedAssignedCallIdsRef = useRef<Set<string>>(new Set());
  const announcedReadyOrderIdsRef = useRef<Set<string>>(new Set());
  const initialHydrationDoneRef = useRef(false);

  // Live Menu state for Waiter Take-Order tab
  const [menuPayload, setMenuPayload] =
    useState<PublicRestaurantMenuPayload | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [orderTableId, setOrderTableId] = useState<string>('');
  const [menuCategoryFilter, setMenuCategoryFilter] = useState<string>('all');
  const [menuSearch, setMenuSearch] = useState('');
  const [orderCart, setOrderCart] = useState<Record<string, number>>({});
  const [waiterGuestName, setWaiterGuestName] = useState('');
  const [waiterKitchenNote, setWaiterKitchenNote] = useState('');
  const [submittingOrder, setSubmittingOrder] = useState<
    'chef' | 'manager' | null
  >(null);

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

  // Load live public menu once for Waiter Take-Order flow
  const reloadLiveMenu = useCallback(async () => {
    setMenuLoading(true);
    try {
      const menu = await businessRepository.getPublicRestaurantMenu(
        business.slug,
        null,
      );
      setMenuPayload(menu);
    } catch {
      setMenuPayload(null);
    } finally {
      setMenuLoading(false);
    }
  }, [business.slug]);

  useEffect(() => {
    let mounted = true;
    businessRepository
      .getPublicRestaurantMenu(business.slug, null)
      .then((menu) => {
        if (mounted) setMenuPayload(menu);
      })
      .catch(() => {
        if (mounted) setMenuPayload(null);
      })
      .finally(() => {
        if (mounted) setMenuLoading(false);
      });
    return () => {
      mounted = false;
    };
  }, [business.slug]);

  // Real-time subscription + 5s polling fallback so Manager -> Waiter assignments arrive immediately
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
    }, 5000);

    const unsubscribe = businessRepository.subscribeToHospitalityRealtime(
      business.id,
      () => {
        if (mounted) {
          void pollFloor();
        }
      },
    );

    return () => {
      mounted = false;
      window.clearInterval(timer);
      unsubscribe();
    };
  }, [business.id, business.slug, staffPinHash]);

  // Effective live table list (prefers real-time floorData.tables which works on standalone staff phones)
  const effectiveTables = useMemo<RestaurantTable[]>(() => {
    if (floorData?.tables && floorData.tables.length > 0) {
      return floorData.tables;
    }
    return tables;
  }, [floorData?.tables, tables]);

  const effectiveOrderTableId = orderTableId || effectiveTables[0]?.id || '';

  const activeCalls = useMemo(
    () => floorData?.activeTableCalls ?? [],
    [floorData?.activeTableCalls],
  );
  const pendingClaims = useMemo(
    () => floorData?.pendingRewardClaims ?? [],
    [floorData?.pendingRewardClaims],
  );
  const tableOrders = useMemo(
    () => floorData?.tableOrders ?? [],
    [floorData?.tableOrders],
  );
  const recentOrders = useMemo(
    () => floorData?.recentOrders ?? tableOrders,
    [floorData?.recentOrders, tableOrders],
  );

  // Tasks specifically assigned by Manager to THIS waiter!
  const myAssignedCalls = useMemo(
    () =>
      activeCalls.filter((call) =>
        matchesLoggedInWaiter(
          call.assignedStaffLabel,
          staffLabel,
          staffCode,
          staffName,
        ),
      ),
    [activeCalls, staffLabel, staffCode, staffName],
  );

  // Dishes marked READY by the Chef on the KDS!
  const readyOrders = useMemo(
    () => tableOrders.filter((o) => o.status === 'ready'),
    [tableOrders],
  );

  const pendingOrderCount = useMemo(
    () => tableOrders.filter((o) => o.status === 'pending_approval').length,
    [tableOrders],
  );

  // Spoken Voice Alert whenever Manager assigns a NEW task to THIS waiter OR Chef marks an order READY!
  useEffect(() => {
    if (!floorData) return;

    const waiterFirstName =
      (staffName ?? staffLabel).split(/[\s(]/)[0]?.trim() || 'Team';

    if (!initialHydrationDoneRef.current) {
      initialHydrationDoneRef.current = true;
      // On initial login, announce if there's already an assigned task waiting for this waiter
      if (myAssignedCalls.length > 0) {
        const first = myAssignedCalls[0];
        const meta =
          TABLE_CALL_TYPE_METADATA[first.callType] ??
          TABLE_CALL_TYPE_METADATA.assistance;
        speakHospitalityAlert(
          `Welcome ${waiterFirstName}. You have ${myAssignedCalls.length} assigned ${myAssignedCalls.length === 1 ? 'task' : 'tasks'}. ${first.tableNumber || 'Table'} is ${meta.spokenPhrase}.`,
          voiceAlertsOn,
        );
      }
      for (const c of myAssignedCalls) {
        announcedAssignedCallIdsRef.current.add(c.id);
      }
      for (const r of readyOrders) {
        announcedReadyOrderIdsRef.current.add(r.id);
      }
      return;
    }

    for (const call of myAssignedCalls) {
      if (!announcedAssignedCallIdsRef.current.has(call.id)) {
        announcedAssignedCallIdsRef.current.add(call.id);
        const meta =
          TABLE_CALL_TYPE_METADATA[call.callType] ??
          TABLE_CALL_TYPE_METADATA.assistance;
        speakHospitalityAlert(
          `Attention ${waiterFirstName}! Manager assigned you to ${call.tableNumber || 'a table'} — ${meta.spokenPhrase}.`,
          voiceAlertsOn,
        );
      }
    }

    for (const ord of readyOrders) {
      if (!announcedReadyOrderIdsRef.current.has(ord.id)) {
        announcedReadyOrderIdsRef.current.add(ord.id);
        speakHospitalityAlert(
          `Order ready at kitchen for ${ord.tableNumber || ord.guestName || 'pickup'}. Please pick up and serve!`,
          voiceAlertsOn,
        );
      }
    }
  }, [floorData, myAssignedCalls, readyOrders, staffLabel, staffName, voiceAlertsOn]);

  // Running unpaid total per table (for visual indicator on table selector pills)
  const unpaidTotalByTableId = useMemo(() => {
    const map = new Map<string, number>();
    for (const ord of recentOrders) {
      if (
        ord.tableId &&
        ord.status !== 'cancelled' &&
        (ord.paymentStatus ?? 'unpaid') !== 'paid'
      ) {
        map.set(
          ord.tableId,
          (map.get(ord.tableId) ?? 0) +
            computeOrderTotalPaise(ord.items, ord.packagingPaise),
        );
      }
    }
    return map;
  }, [recentOrders]);

  const currencyCode: RestaurantCurrencyCode =
    menuPayload?.profile?.currencyCode ?? profile?.currencyCode ?? 'INR';

  const orderingActive =
    Boolean(floorData?.tableOrderingEnabled) ||
    Boolean(menuPayload?.profile?.tableOrderingEnabled) ||
    Boolean(profile?.tableOrderingEnabled);

  // Menu items & categories for Waiter Take-Order tab
  const menuCategories: RestaurantMenuCategory[] = useMemo(
    () => menuPayload?.categories ?? [],
    [menuPayload?.categories],
  );
  const availableDishes: RestaurantMenuItem[] = useMemo(
    () => (menuPayload?.items ?? []).filter((i) => i.isAvailable),
    [menuPayload?.items],
  );
  const filteredDishes = useMemo(() => {
    const q = menuSearch.trim().toLowerCase();
    return availableDishes.filter((dish) => {
      if (
        menuCategoryFilter !== 'all' &&
        dish.categoryId !== menuCategoryFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        dish.name.toLowerCase().includes(q) ||
        (dish.description ?? '').toLowerCase().includes(q)
      );
    });
  }, [availableDishes, menuCategoryFilter, menuSearch]);

  const selectedOrderTable = useMemo(
    () => effectiveTables.find((t) => t.id === effectiveOrderTableId) ?? null,
    [effectiveTables, effectiveOrderTableId],
  );

  const cartLines = useMemo(() => {
    const byId = new Map(availableDishes.map((d) => [d.id, d]));
    const lines: Array<{ dish: RestaurantMenuItem; quantity: number }> = [];
    for (const [id, qty] of Object.entries(orderCart)) {
      if (qty > 0) {
        const dish = byId.get(id);
        if (dish) lines.push({ dish, quantity: qty });
      }
    }
    return lines;
  }, [availableDishes, orderCart]);

  const cartItemCount = useMemo(
    () => cartLines.reduce((sum, l) => sum + l.quantity, 0),
    [cartLines],
  );
  const cartTotalPaise = useMemo(
    () =>
      cartLines.reduce(
        (sum, l) => sum + l.dish.pricePaise * l.quantity,
        0,
      ),
    [cartLines],
  );

  function adjustCartQty(itemId: string, delta: number) {
    setOrderCart((prev) => {
      const next = (prev[itemId] ?? 0) + delta;
      if (next <= 0) {
        const copy = { ...prev };
        delete copy[itemId];
        return copy;
      }
      return { ...prev, [itemId]: Math.min(20, next) };
    });
  }

  async function handleSubmitWaiterOrder(route: 'chef' | 'manager') {
    if (!selectedOrderTable) {
      reportError('Please select which Table or Room you are taking an order for.');
      return;
    }
    if (cartLines.length === 0) {
      reportError('Add at least one dish to place the table order.');
      return;
    }

    setSubmittingOrder(route);
    setLocalError(null);
    const itemsPayload = cartLines.map((l) => ({
      itemId: l.dish.id,
      quantity: l.quantity,
    }));

    try {
      if (route === 'chef') {
        const isRoom = selectedOrderTable.locationType === 'room';
        await businessRepository.createPosOrPlatformOrder({
          businessId: business.id,
          orderSource: isRoom ? 'qr_room' : 'pos_dine_in',
          tableId: selectedOrderTable.id,
          customerName: waiterGuestName.trim() || null,
          kitchenNote: waiterKitchenNote.trim() || null,
          items: itemsPayload,
          staffLabel,
          staffPinHash: staffPinHash ?? null,
        });
        setOrderCart({});
        setWaiterGuestName('');
        setWaiterKitchenNote('');
        await refreshFloorData();
        reportStatus(
          `Approved & Sent ${cartItemCount} item${cartItemCount === 1 ? '' : 's'} for ${selectedOrderTable.tableNumber} directly to Chef KDS! (Live on Main Dashboard too ✓)`,
        );
        setActiveTab('orders');
      } else {
        await businessRepository.submitCustomerTableOrder({
          businessSlug: business.slug,
          tableKey: selectedOrderTable.tableKey,
          guestName: waiterGuestName.trim()
            ? `${waiterGuestName.trim()} (via ${staffLabel})`
            : `Taken by ${staffLabel}`,
          kitchenNote: waiterKitchenNote.trim() || null,
          items: itemsPayload,
        });
        setOrderCart({});
        setWaiterGuestName('');
        setWaiterKitchenNote('');
        await refreshFloorData();
        reportStatus(
          `Sent ${selectedOrderTable.tableNumber} order (${cartItemCount} item${cartItemCount === 1 ? '' : 's'}) to Main Dashboard for Manager Approval ✓`,
        );
        setActiveTab('orders');
      }
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setSubmittingOrder(null);
    }
  }

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
          if (matchesPendingClaim) {
            throw claimErr;
          }
        }
      }

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

  async function handleUpdateTableCall(
    call: RestaurantTableCall,
    nextStatus: 'acknowledged' | 'resolved',
  ) {
    setProcessingLookup(true);
    try {
      await businessRepository.updateRestaurantTableCallStatus({
        businessSlug: business.slug,
        callId: call.id,
        status: nextStatus,
        assignedStaffLabel: call.assignedStaffLabel || staffLabel,
        staffPinHash: staffPinHash ?? null,
      });
      await refreshFloorData();
      const meta =
        TABLE_CALL_TYPE_METADATA[call.callType] ??
        TABLE_CALL_TYPE_METADATA.assistance;
      reportStatus(
        nextStatus === 'acknowledged'
          ? `Confirmed On My Way → ${call.tableNumber || 'Table'} (${meta.label}) ✓`
          : `Completed ${call.tableNumber || 'Table'} — ${meta.label} ✓`,
      );
    } catch (err) {
      reportError((err as Error).message);
    } finally {
      setProcessingLookup(false);
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

  const trimmedLookup = unifiedLookup.trim();
  const isSixCharClaimInput =
    /^[A-Z0-9]{6}$/.test(trimmedLookup.toUpperCase()) &&
    !trimmedLookup.includes('@') &&
    !trimmedLookup.toLowerCase().startsWith('vitaran-loyalty://');

  return (
    <div className="space-y-3.5 animate-fadeSlideUp">
      {/* Compact Top Live Sync & Voice Alert Bar */}
      <div className="flex items-center justify-between gap-2 rounded-2xl border border-[#1E1B4B]/10 bg-[#FFFFFF] px-3.5 py-2 shadow-2xs">
        <div className="flex items-center gap-2 min-w-0">
          <span className="inline-flex h-2 w-2 rounded-full bg-emerald-500 animate-pulse shrink-0" />
          <span className="truncate text-[11.5px] font-extrabold text-[#111827]">
            Live Floor Sync
          </span>
          {myAssignedCalls.length > 0 && (
            <span className="rounded-full bg-rose-600 px-2 py-0.5 text-[10px] font-extrabold text-white tabular-nums">
              {myAssignedCalls.length} For You
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={() => setVoiceAlertsOn((prev) => !prev)}
            className={`inline-flex h-7 items-center gap-1 rounded-lg border px-2 text-[10.5px] font-extrabold transition cursor-pointer ${
              voiceAlertsOn
                ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {voiceAlertsOn ? (
              <Volume2 className="h-3 w-3" aria-hidden />
            ) : (
              <VolumeX className="h-3 w-3" aria-hidden />
            )}
            <span>{voiceAlertsOn ? 'Voice ON' : 'Muted'}</span>
          </button>
          <button
            type="button"
            onClick={() => void refreshFloorData()}
            aria-label="Sync Live Floor"
            className="inline-flex h-7 items-center gap-1 rounded-lg border border-[#1E1B4B]/15 bg-[#F8F9FA] px-2 text-[10.5px] font-bold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-white transition cursor-pointer"
          >
            <RefreshCw className="h-3 w-3" aria-hidden />
            <span>Sync</span>
          </button>
        </div>
      </div>

      {/* =====================================================================
          PERSONAL ASSIGNED TASK PRIORITY NOTIFICATIONS (ALWAYS VISIBLE!)
         ===================================================================== */}
      {myAssignedCalls.length > 0 && (
        <section
          aria-label="Tasks Assigned To You"
          className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-3.5 shadow-md space-y-2.5"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-600 opacity-75" />
                <span className="relative inline-flex h-3 w-3 rounded-full bg-rose-600" />
              </span>
              <p className="text-[12px] font-extrabold uppercase tracking-wider text-rose-900">
                🔔 Assigned To You ({myAssignedCalls.length})
              </p>
            </div>
            <span className="rounded-full bg-rose-600 px-2.5 py-0.5 text-[10px] font-extrabold text-white">
              ACTION NEEDED
            </span>
          </div>

          <div className="space-y-2">
            {myAssignedCalls.map((call) => {
              const meta =
                TABLE_CALL_TYPE_METADATA[call.callType] ??
                TABLE_CALL_TYPE_METADATA.assistance;
              const elapsed = formatElapsedOccupancy(call.createdAt);
              const isAcknowledged = call.status === 'acknowledged';

              return (
                <div
                  key={call.id}
                  className="rounded-xl border border-rose-200 bg-[#FFFFFF] p-3 space-y-2.5 shadow-2xs"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-[15px] font-extrabold text-[#111827] leading-tight">
                        Go to {call.tableNumber || 'Table'} — {meta.emoji}{' '}
                        {meta.label}
                      </p>
                      <p className="mt-0.5 flex items-center gap-1.5 text-[11px] font-semibold text-rose-800">
                        <Clock className="h-3 w-3" aria-hidden />
                        <span>{elapsed || 'Just now'}</span>
                        <span>•</span>
                        <span>Assigned to {call.assignedStaffLabel}</span>
                      </p>
                    </div>
                    {isAcknowledged && (
                      <span className="shrink-0 rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-amber-900">
                        ON THE WAY
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {!isAcknowledged && (
                      <button
                        type="button"
                        disabled={processingLookup}
                        onClick={() =>
                          void handleUpdateTableCall(call, 'acknowledged')
                        }
                        className="flex-1 rounded-xl border border-[#1E1B4B]/20 bg-[#F8F9FA] py-2 text-[12px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B]/5 active:scale-[0.98] transition cursor-pointer"
                      >
                        🏃 On My Way
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={processingLookup}
                      onClick={() => void handleUpdateTableCall(call, 'resolved')}
                      className="flex-1 rounded-xl bg-emerald-600 py-2 text-[12px] font-extrabold text-white shadow-xs hover:bg-emerald-700 active:scale-[0.98] transition cursor-pointer"
                    >
                      ✓ Done / Completed
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* =====================================================================
          KITCHEN READY-TO-PICKUP CALLOUT BANNER (ALWAYS VISIBLE!)
         ===================================================================== */}
      {readyOrders.length > 0 && (
        <section
          aria-label="Orders Ready at Kitchen"
          className="rounded-2xl border-2 border-emerald-500 bg-emerald-50 p-3 space-y-2 shadow-sm"
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11.5px] font-extrabold uppercase tracking-wider text-emerald-900 flex items-center gap-1.5">
              <ChefHat className="h-4 w-4 text-emerald-700" aria-hidden />
              🍽️ Ready at Kitchen — Pick Up ({readyOrders.length})
            </p>
            <button
              type="button"
              onClick={() => setActiveTab('orders')}
              className="text-[11px] font-extrabold text-emerald-800 underline cursor-pointer"
            >
              View All
            </button>
          </div>
          <div className="space-y-1.5">
            {readyOrders.slice(0, 3).map((ord) => (
              <div
                key={ord.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-white px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-extrabold text-[#111827]">
                    {ord.tableNumber || ord.guestName || 'Pickup Order'}
                  </p>
                  <p className="truncate text-[11px] font-semibold text-[#6B7280]">
                    {ord.items.map((i) => `${i.quantity}× ${i.name}`).join(', ')}
                  </p>
                </div>
                <button
                  type="button"
                  disabled={processingLookup}
                  onClick={() => void handleUpdateTableOrder(ord.id, 'served')}
                  className="shrink-0 rounded-xl bg-emerald-600 px-3 py-1.5 text-[11.5px] font-extrabold text-white hover:bg-emerald-700 active:scale-[0.98] transition cursor-pointer"
                >
                  ✓ Served
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

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

      {/* 4-TAB MOBILE WAITER NAVIGATION BAR */}
      <nav
        aria-label="Waiter Floor Views"
        className="bistro-card p-1.5 grid grid-cols-4 gap-1"
      >
        <button
          type="button"
          onClick={() => setActiveTab('take_order')}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 text-[10.5px] font-extrabold transition-all cursor-pointer ${
            activeTab === 'take_order'
              ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-sm'
              : 'text-[#6B7280] hover:bg-[#F8F9FA] hover:text-[#111827]'
          }`}
        >
          <UtensilsCrossed
            className={`h-4 w-4 ${
              activeTab === 'take_order' ? 'text-[#D2DB76]' : 'text-[#1E1B4B]'
            }`}
            aria-hidden
          />
          <span>Take Order</span>
          {cartItemCount > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D2DB76] px-1 text-[9.5px] font-extrabold text-[#1E1B4B] tabular-nums">
              {cartItemCount}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 text-[10.5px] font-extrabold transition-all cursor-pointer ${
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
          <span>Orders→Chef</span>
          {(pendingOrderCount > 0 || readyOrders.length > 0) && (
            <span
              className={`absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[9.5px] font-extrabold text-white tabular-nums ${
                readyOrders.length > 0 ? 'bg-emerald-600' : 'bg-[#D97706]'
              }`}
            >
              {pendingOrderCount + readyOrders.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('tables')}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 text-[10.5px] font-extrabold transition-all cursor-pointer ${
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
          <span>Live Tables</span>
          {activeCalls.length > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9.5px] font-extrabold text-white tabular-nums">
              {activeCalls.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('scan')}
          className={`relative flex flex-col items-center justify-center gap-1 rounded-xl py-2.5 px-1 text-[10.5px] font-extrabold transition-all cursor-pointer ${
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
          <span>Scan &amp; ★</span>
          {pendingClaims.length > 0 && (
            <span className="absolute top-1 right-1 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[#D97706] px-1 text-[9.5px] font-extrabold text-white tabular-nums">
              {pendingClaims.length}
            </span>
          )}
        </button>
      </nav>

      {/* =====================================================================
          TAB 1 — WAITER TAKE TABLE ORDER (DUAL ROUTE: DIRECT TO CHEF OR MANAGER)
         ===================================================================== */}
      {activeTab === 'take_order' && (
        <div className="space-y-3.5 animate-fadeSlideUp">
          {/* Step 1: Select Exact Table / Room */}
          <div className="bistro-card p-3.5 space-y-2.5">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
                1. Which Table / Room Are You Serving?
              </p>
              {selectedOrderTable && (
                <span className="rounded-full bg-[#D2DB76] px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#1E1B4B]">
                  ✓ {selectedOrderTable.tableNumber}
                </span>
              )}
            </div>

            {effectiveTables.length === 0 ? (
              <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[12px] font-semibold text-amber-900">
                No tables found yet. Ask the owner to create tables in the Dashboard first.
              </p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {effectiveTables.map((tbl, idx) => {
                  const isSelected = tbl.id === effectiveOrderTableId;
                  const runningPaise = unpaidTotalByTableId.get(tbl.id) ?? 0;
                  const hasCall = activeCalls.some((c) => c.tableId === tbl.id);
                  const shortCode = getShortTableCode(
                    tbl.tableNumber,
                    idx,
                    tbl.locationType,
                  );

                  return (
                    <button
                      key={tbl.id}
                      type="button"
                      onClick={() => setOrderTableId(tbl.id)}
                      className={`relative flex flex-col items-center justify-center rounded-xl border-2 px-2 py-2.5 text-center transition-all active:scale-[0.97] cursor-pointer ${
                        isSelected
                          ? 'border-[#1E1B4B] bg-[#1E1B4B] text-white shadow-sm'
                          : hasCall
                            ? 'border-rose-400 bg-rose-50 text-rose-950'
                            : runningPaise > 0
                              ? 'border-amber-400 bg-amber-50 text-amber-950'
                              : 'border-emerald-300 bg-emerald-50/70 text-emerald-950'
                      }`}
                    >
                      <span className="flex items-center gap-1 text-[14px] font-extrabold leading-none tabular-nums">
                        {tbl.locationType === 'room' && (
                          <BedDouble className="h-3.5 w-3.5" aria-hidden />
                        )}
                        {shortCode}
                      </span>
                      <span
                        className={`mt-1 truncate max-w-full text-[9.5px] font-bold ${
                          isSelected ? 'text-[#D2DB76]' : 'opacity-80'
                        }`}
                      >
                        {runningPaise > 0
                          ? formatPriceFromPaise(runningPaise, currencyCode)
                          : tbl.tableLabel || tbl.tableNumber}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 2: Pick Menu Dishes */}
          <div className="bistro-card p-3.5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
                2. Tap Dishes From Live Menu
              </p>
              <button
                type="button"
                onClick={() => void reloadLiveMenu()}
                className="text-[11px] font-bold text-[#6B7280] hover:text-[#1E1B4B] inline-flex items-center gap-1 cursor-pointer"
              >
                <RefreshCw className="h-3 w-3" aria-hidden /> Reload
              </button>
            </div>

            {/* Search Input */}
            <div className="relative flex items-center rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3 focus-within:border-[#1E1B4B] focus-within:bg-white">
              <Search className="h-4 w-4 text-[#6B7280] shrink-0" aria-hidden />
              <input
                type="text"
                value={menuSearch}
                onChange={(e) => setMenuSearch(e.target.value)}
                placeholder="Search biryani, paneer, coffee, tea…"
                className="h-10 w-full bg-transparent pl-2 text-[13px] font-semibold text-[#111827] placeholder:text-[#6B7280] focus:outline-none"
              />
            </div>

            {/* Category Pills */}
            {menuCategories.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setMenuCategoryFilter('all')}
                  className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                    menuCategoryFilter === 'all'
                      ? 'bg-[#1E1B4B] text-[#D2DB76]'
                      : 'bg-[#F8F9FA] text-[#6B7280] border border-[#1E1B4B]/10'
                  }`}
                >
                  All ({availableDishes.length})
                </button>
                {menuCategories.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setMenuCategoryFilter(cat.id)}
                    className={`rounded-full px-2.5 py-1 text-[11px] font-extrabold transition cursor-pointer ${
                      menuCategoryFilter === cat.id
                        ? 'bg-[#1E1B4B] text-[#D2DB76]'
                        : 'bg-[#F8F9FA] text-[#6B7280] border border-[#1E1B4B]/10'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>
            )}

            {/* Dishes List */}
            {menuLoading ? (
              <p className="py-6 text-center text-[12.5px] font-medium text-[#6B7280]">
                Loading menu dishes…
              </p>
            ) : filteredDishes.length === 0 ? (
              <p className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-center text-[12px] font-medium text-[#6B7280]">
                No available dishes match your filter.
              </p>
            ) : (
              <div className="max-h-72 overflow-y-auto pr-1 space-y-2">
                {filteredDishes.map((dish) => {
                  const qty = orderCart[dish.id] ?? 0;
                  const dietMeta =
                    DIETARY_TAG_METADATA[dish.dietaryTag] ??
                    DIETARY_TAG_METADATA.none;

                  return (
                    <div
                      key={dish.id}
                      className={`flex items-center justify-between gap-2.5 rounded-xl border p-2.5 transition ${
                        qty > 0
                          ? 'border-[#1E1B4B] bg-[#1E1B4B]/[0.04]'
                          : 'border-[#1E1B4B]/10 bg-white'
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className="inline-block h-2.5 w-2.5 shrink-0 rounded-full"
                            style={{ backgroundColor: dietMeta.dotColor }}
                            title={dietMeta.label}
                          />
                          <p className="truncate text-[13px] font-extrabold text-[#111827]">
                            {dish.name}
                          </p>
                        </div>
                        <p className="mt-0.5 text-[12px] font-bold text-[#1E1B4B] tabular-nums">
                          {formatPriceFromPaise(dish.pricePaise, currencyCode)}
                        </p>
                      </div>

                      {qty === 0 ? (
                        <button
                          type="button"
                          onClick={() => adjustCartQty(dish.id, 1)}
                          className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#1E1B4B] px-3 text-[11.5px] font-extrabold text-white active:scale-[0.96] transition cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                          Add
                        </button>
                      ) : (
                        <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#1E1B4B] bg-white p-0.5">
                          <button
                            type="button"
                            aria-label={`Remove one ${dish.name}`}
                            onClick={() => adjustCartQty(dish.id, -1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#F8F9FA] text-[#1E1B4B] hover:bg-rose-50 hover:text-rose-700 cursor-pointer"
                          >
                            <Minus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                          <span className="min-w-5 text-center text-[13px] font-extrabold text-[#1E1B4B] tabular-nums">
                            {qty}
                          </span>
                          <button
                            type="button"
                            aria-label={`Add one more ${dish.name}`}
                            onClick={() => adjustCartQty(dish.id, 1)}
                            className="flex h-7 w-7 items-center justify-center rounded-md bg-[#1E1B4B] text-[#D2DB76] cursor-pointer"
                          >
                            <Plus className="h-3.5 w-3.5" aria-hidden />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Step 3: Order Summary, Optional Kitchen Note & Dual-Route Submit */}
          <div className="bistro-card p-3.5 space-y-3 border-2 border-[#1E1B4B]/15">
            <div className="flex items-center justify-between gap-2">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#1E1B4B]">
                3. Order Summary ({cartItemCount} item{cartItemCount === 1 ? '' : 's'})
              </p>
              <span className="text-[16px] font-extrabold text-[#1E1B4B] tabular-nums">
                {formatPriceFromPaise(cartTotalPaise, currencyCode)}
              </span>
            </div>

            {cartLines.length > 0 && (
              <div className="rounded-xl bg-[#F8F9FA] border border-[#1E1B4B]/10 p-2.5 space-y-1">
                {cartLines.map(({ dish, quantity }) => (
                  <div
                    key={dish.id}
                    className="flex items-center justify-between text-[12px] font-semibold text-[#111827]"
                  >
                    <span className="truncate">
                      {quantity}× {dish.name}
                    </span>
                    <span className="shrink-0 font-bold tabular-nums">
                      {formatPriceFromPaise(
                        dish.pricePaise * quantity,
                        currencyCode,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <input
                type="text"
                maxLength={60}
                value={waiterGuestName}
                onChange={(e) => setWaiterGuestName(e.target.value)}
                placeholder="Guest Name (optional)"
                className="h-10 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3 text-[12.5px] font-semibold text-[#111827] placeholder:text-[#6B7280] focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
              />
              <input
                type="text"
                maxLength={160}
                value={waiterKitchenNote}
                onChange={(e) => setWaiterKitchenNote(e.target.value)}
                placeholder="Kitchen note (e.g. Less spicy, no onion)"
                className="h-10 rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] px-3 text-[12.5px] font-semibold text-[#111827] placeholder:text-[#6B7280] focus:border-[#1E1B4B] focus:bg-white focus:outline-none"
              />
            </div>

            {/* Dual-Route Buttons: Direct to Chef OR Manager Approval */}
            <div className="space-y-2 pt-0.5">
              <button
                type="button"
                disabled={
                  submittingOrder !== null ||
                  !selectedOrderTable ||
                  cartLines.length === 0
                }
                onClick={() => void handleSubmitWaiterOrder('chef')}
                className="flex min-h-12 w-full items-center justify-center gap-2 rounded-xl bg-[#1E1B4B] px-4 py-3 text-[13px] font-extrabold text-white shadow-sm hover:bg-[#2E2A6E] active:scale-[0.98] transition disabled:opacity-50 cursor-pointer"
              >
                <ChefHat className="h-4 w-4 text-[#D2DB76]" aria-hidden />
                <span>
                  {submittingOrder === 'chef'
                    ? 'Sending KOT to Chef…'
                    : `Approve & Send Directly to Chef (${selectedOrderTable?.tableNumber ?? 'Pick Table'})`}
                </span>
              </button>

              <button
                type="button"
                disabled={
                  submittingOrder !== null ||
                  !selectedOrderTable ||
                  cartLines.length === 0 ||
                  !orderingActive
                }
                onClick={() => void handleSubmitWaiterOrder('manager')}
                className="flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border-2 border-[#1E1B4B]/20 bg-white px-4 py-2.5 text-[12.5px] font-extrabold text-[#1E1B4B] hover:bg-[#F8F9FA] active:scale-[0.98] transition disabled:opacity-45 cursor-pointer"
              >
                <ClipboardCheck className="h-4 w-4" aria-hidden />
                <span>
                  {submittingOrder === 'manager'
                    ? 'Sending to Manager…'
                    : 'Send to Main Dashboard (Manager Approval)'}
                </span>
              </button>

              <p className="text-center text-[11px] font-medium text-[#6B7280]">
                {orderingActive
                  ? 'Orders sent directly to Chef also appear live on the Main Owner Dashboard tagged with your name.'
                  : 'Direct-to-Chef works anytime & syncs live to Main Dashboard. Turn ON QR Ordering in Dashboard to use Manager Queue.'}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2 — APPROVE ORDERS → CHEF & SERVE READY DISHES
         ===================================================================== */}
      {activeTab === 'orders' && (
        <div className="bistro-card p-4 space-y-3.5 animate-fadeSlideUp">
          <div className="flex items-center justify-between gap-2">
            <div>
              <span className="inline-flex items-center gap-1 rounded-full bg-[#1E1B4B] px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider text-[#D2DB76]">
                Approval 1 • Order → Chef → Serve
              </span>
              <h2 className="mt-1 text-[15px] font-extrabold text-[#111827] flex items-center gap-1.5">
                <ChefHat className="h-4 w-4 text-[#1E1B4B]" aria-hidden />
                Active Orders &amp; Kitchen Queue ({tableOrders.length})
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

          {tableOrders.length === 0 ? (
            <div className="rounded-xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-6 text-center space-y-2">
              <p className="text-[13.5px] font-bold text-[#111827]">
                No active kitchen orders right now
              </p>
              <p className="text-[12px] text-[#6B7280]">
                Guest QR orders, Waiter orders, and Counter POS orders appear here live in real time.
              </p>
              <button
                type="button"
                onClick={() => setActiveTab('take_order')}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 py-2 text-[12px] font-extrabold text-white cursor-pointer"
              >
                <Send className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
                Take a Table Order
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {tableOrders.map((ord) => {
                const itemsLine = ord.items
                  .map((i) => `${i.quantity}× ${i.name}`)
                  .join(', ');
                const note =
                  ord.kitchenNote || ord.items.find((i) => i.notes)?.notes;
                const srcMeta =
                  ORDER_SOURCE_METADATA[ord.orderSource ?? 'qr_table'] ??
                  ORDER_SOURCE_METADATA.qr_table;

                return (
                  <div
                    key={ord.id}
                    className={`rounded-2xl border-2 p-3.5 space-y-2.5 ${
                      ord.status === 'ready'
                        ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                        : ord.status === 'pending_approval'
                          ? 'border-amber-400 bg-amber-50/70'
                          : ord.status === 'approved_for_kitchen'
                            ? 'border-[#1E1B4B]/20 bg-[#F8F9FA]'
                            : 'border-sky-300 bg-sky-50/50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <span className="text-[14px] font-extrabold text-[#111827] block truncate">
                          {ord.tableNumber || 'Counter / Delivery Order'}
                          {ord.guestName ? ` • ${ord.guestName}` : ''}
                        </span>
                        <div className="mt-1 flex flex-wrap items-center gap-1.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[9.5px] font-extrabold ${srcMeta.badgeBg} ${srcMeta.badgeText}`}
                          >
                            {srcMeta.shortLabel}
                          </span>
                          <span className="text-[11px] font-bold text-[#1E1B4B] tabular-nums">
                            {formatPriceFromPaise(
                              computeOrderTotalPaise(
                                ord.items,
                                ord.packagingPaise,
                              ),
                              currencyCode,
                            )}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase ${
                          ord.status === 'ready'
                            ? 'bg-emerald-600 text-white'
                            : ord.status === 'pending_approval'
                              ? 'bg-[#D97706] text-[#FFFFFF]'
                              : ord.status === 'approved_for_kitchen'
                                ? 'bg-[#1E1B4B] text-[#D2DB76]'
                                : 'bg-sky-700 text-[#FFFFFF]'
                        }`}
                      >
                        {ord.status === 'ready'
                          ? '🔔 READY TO PICK UP'
                          : ord.status === 'pending_approval'
                            ? 'Pending Approval'
                            : ord.status === 'approved_for_kitchen'
                              ? 'Sent to Chef'
                              : 'Chef Cooking'}
                      </span>
                    </div>

                    <p className="text-[13px] font-semibold text-[#111827]">
                      {itemsLine}
                    </p>
                    {note && (
                      <p className="text-[11.5px] italic text-[#D97706]">
                        Kitchen Note: &ldquo;{note}&rdquo;
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
                            Approve → Send to Chef
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
                      {(ord.status === 'preparing' ||
                        ord.status === 'ready') && (
                        <button
                          type="button"
                          disabled={processingLookup}
                          onClick={() =>
                            void handleUpdateTableOrder(ord.id, 'served')
                          }
                          className="flex-1 rounded-xl bg-[#059669] py-2.5 text-[12.5px] font-extrabold text-[#FFFFFF] shadow-xs active:scale-[0.98] transition-all cursor-pointer"
                        >
                          {ord.status === 'ready'
                            ? '🍽️ Picked Up & Served to Table ✓'
                            : 'Mark Served ✓'}
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
          TAB 3 — LIVE VISUAL TABLE MAP & REQUEST DISPATCH
         ===================================================================== */}
      {activeTab === 'tables' && (
        <div className="space-y-3 animate-fadeSlideUp">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="text-[13px] font-extrabold uppercase tracking-wider text-[#111827]">
                LIVE FLOOR TABLES ({effectiveTables.length})
              </h2>
              {selectedTableKey && (
                <span className="rounded-full bg-[#D2DB76]/60 px-2.5 py-0.5 text-[10.5px] font-extrabold text-[#1E1B4B]">
                  Scan Tag: {selectedTableKey}
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

          {effectiveTables.length === 0 ? (
            <div className="bistro-card p-8 text-center text-[13px] text-[#6B7280]">
              No tables configured yet. Add tables in the Owner Workspace under &ldquo;Tables &amp; QRs&rdquo;.
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {effectiveTables.map((tbl, idx) => {
                const call = activeCalls.find((c) => c.tableId === tbl.id);
                const shortCode = getShortTableCode(
                  tbl.tableNumber,
                  idx,
                  tbl.locationType,
                );
                const isSelected = selectedTableKey === tbl.tableKey;
                const unpaidPaise = unpaidTotalByTableId.get(tbl.id) ?? 0;

                if (call) {
                  const callMeta =
                    TABLE_CALL_TYPE_METADATA[call.callType] ??
                    TABLE_CALL_TYPE_METADATA.assistance;
                  const assignedToMe = matchesLoggedInWaiter(
                    call.assignedStaffLabel,
                    staffLabel,
                    staffCode,
                    staffName,
                  );

                  return (
                    <div
                      key={tbl.id}
                      className={`relative flex flex-col justify-between gap-2 rounded-2xl border-2 p-3.5 text-center shadow-sm ${
                        assignedToMe
                          ? 'border-rose-600 bg-rose-50'
                          : 'border-amber-500 bg-amber-50'
                      }`}
                    >
                      <span className="absolute top-2.5 right-2.5 flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-600 opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-rose-600" />
                      </span>

                      <div className="space-y-1 pt-1">
                        <span className="text-[28px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums block">
                          {shortCode}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-white/90 border border-rose-200 px-2.5 py-0.5 text-[10.5px] font-extrabold text-rose-900">
                          {callMeta.emoji} {callMeta.label}
                          <BellRing className="h-3 w-3" aria-hidden />
                        </span>
                        {call.assignedStaffLabel && (
                          <p
                            className={`text-[10.5px] font-extrabold ${
                              assignedToMe ? 'text-rose-700' : 'text-amber-900'
                            }`}
                          >
                            {assignedToMe
                              ? '★ Assigned to YOU'
                              : `Assigned: ${call.assignedStaffLabel}`}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-col gap-1.5 pt-1">
                        {!call.assignedStaffLabel && (
                          <button
                            type="button"
                            disabled={processingLookup}
                            onClick={() =>
                              void handleUpdateTableCall(call, 'acknowledged')
                            }
                            className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-[#1E1B4B] py-1.5 text-[11px] font-extrabold text-[#D2DB76] active:scale-[0.98] cursor-pointer"
                          >
                            <Hand className="h-3 w-3" aria-hidden />
                            Claim Task
                          </button>
                        )}
                        <button
                          type="button"
                          disabled={processingLookup}
                          onClick={() =>
                            void handleUpdateTableCall(call, 'resolved')
                          }
                          className="w-full rounded-xl bg-emerald-600 py-1.5 text-[11px] font-extrabold text-white active:scale-[0.98] cursor-pointer"
                        >
                          ✓ Done / Resolve
                        </button>
                      </div>
                    </div>
                  );
                }

                return (
                  <div
                    key={tbl.id}
                    className={`flex flex-col justify-between gap-2 rounded-2xl border-2 p-3.5 text-center shadow-2xs transition ${
                      isSelected
                        ? 'border-[#1E1B4B] bg-white ring-2 ring-[#D2DB76]'
                        : unpaidPaise > 0
                          ? 'border-amber-300 bg-amber-50/70'
                          : 'border-emerald-200 bg-emerald-50/40'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() =>
                        setSelectedTableKey((prev) =>
                          prev === tbl.tableKey ? '' : tbl.tableKey,
                        )
                      }
                      className="space-y-1 cursor-pointer"
                    >
                      <span className="text-[28px] leading-none font-extrabold tracking-tight text-[#111827] tabular-nums block">
                        {shortCode}
                      </span>
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                          unpaidPaise > 0
                            ? 'bg-amber-200/80 text-amber-950'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {unpaidPaise > 0
                          ? `OPEN • ${formatPriceFromPaise(unpaidPaise, currencyCode)}`
                          : 'AVAILABLE'}
                      </span>
                      <span className="block text-[11px] font-medium text-[#6B7280] truncate">
                        {tbl.tableNumber}
                        {tbl.tableLabel ? ` • ${tbl.tableLabel}` : ''}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setOrderTableId(tbl.id);
                        setActiveTab('take_order');
                      }}
                      className="w-full inline-flex items-center justify-center gap-1 rounded-xl bg-[#1E1B4B] py-1.5 text-[11px] font-extrabold text-white hover:bg-[#2E2A6E] active:scale-[0.98] transition cursor-pointer"
                    >
                      <Plus className="h-3 w-3 text-[#D2DB76]" aria-hidden />
                      Take Order
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4 — SCAN & AWARD LOYALTY STARS (APPROVAL 2: PAID BILL → +1 STAR)
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
    </div>
  );
}
