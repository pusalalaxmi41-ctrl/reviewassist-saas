import { useCallback, useEffect, useRef, useState } from 'react';
import {
  Scissors,
  Clock,
  Users,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  UserPlus,
  Play,
  UserX,
  QrCode,
  Download,
  FileText,
  Settings,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
  Plus,
  Trash2,
  ScanLine,
  CalendarClock,
  IndianRupee,
  TrendingUp,
  Camera,
  X,
} from 'lucide-react';
import { BARBER_UI_MEDIA, resolveBarberPortrait } from '../../config/barberMedia';
import type { Business } from '../../types/business';
import type {
  BarberBookingType,
  BarberQueueDelayIncrement,
  BarberQueueService,
  BarberQueueTicketStatus,
  BarberRevenueSummary,
  PublicBarberQueueStatusPayload,
} from '../../types/barberQueue';
import { businessRepository } from '../../services/storage';
import {
  ALLOWED_QUEUE_DELAY_INCREMENTS,
  formatTicketDisplayCode,
  formatTimeSlot12h,
  generateBookableTimeSlots,
  getBarberQueueUrl,
  getBarberStaffUrl,
  getTodayQueueDateKey,
  parseBarberQueueTicketQr,
} from '../../utils/barberQueueValidation';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import {
  generatePrintablePdfBlobFromCanvas,
  loadBusinessQRSettings,
  renderQrPosterToCanvas,
} from '../../services/qr/qrGenerator';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';

const BOOKABLE_TIME_SLOTS = generateBookableTimeSlots();

interface Props {
  business: Business;
  isBusinessLive: boolean;
  mode: 'owner' | 'barber_staff';
  staffPinHash?: string | null;
  staffLabel?: string;
  hideConfigSection?: boolean;
}

export function BarberQueueManagerView({
  business,
  isBusinessLive,
  mode,
  staffPinHash = null,
  staffLabel = 'Owner',
  hideConfigSection = false,
}: Props) {
  const [queueData, setQueueData] =
    useState<PublicBarberQueueStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [extendingMins, setExtendingMins] =
    useState<BarberQueueDelayIncrement | null>(null);
  const [busyTicketId, setBusyTicketId] = useState<string | null>(null);
  const [togglingOpen, setTogglingOpen] = useState(false);

  // Quick Walk-In & Phone/Online Appointment Entry
  const [entryFormMode, setEntryFormMode] = useState<
    null | BarberBookingType
  >(null);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInService, setWalkInService] = useState('Classic Haircut');
  const [apptSlotTime, setApptSlotTime] = useState('16:30');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

  // Daily & Monthly Haircut & Service Revenue Ledger (Owner mode)
  const [revenueSummary, setRevenueSummary] =
    useState<BarberRevenueSummary | null>(null);
  const [revenueRange, setRevenueRange] = useState<'today' | 'month'>('today');
  const [selectedMonthKey, setSelectedMonthKey] = useState<string>(() =>
    getTodayQueueDateKey().slice(0, 7),
  );

  // Owner Settings & Services Editor
  const [showSettings, setShowSettings] = useState(false);
  const [avgServiceMinutes, setAvgServiceMinutes] = useState(20);
  const [maxQueueSize, setMaxQueueSize] = useState(25);
  const [awardStarOnCompletion, setAwardStarOnCompletion] = useState(true);
  const [servicesDraft, setServicesDraft] = useState<BarberQueueService[]>([]);
  const [newSvcName, setNewSvcName] = useState('');
  const [newSvcMins, setNewSvcMins] = useState(20);
  const [newSvcPriceRupees, setNewSvcPriceRupees] = useState('200');
  const [savingConfig, setSavingConfig] = useState(false);

  // Printable Live Queue QR Standee Studio (Owner mode)
  const [showQrStudio, setShowQrStudio] = useState(false);
  const [copiedQueueUrl, setCopiedQueueUrl] = useState(false);
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);

  // Customer Personal Token QR Check-In lookup (scans or accepts vitaran-queue://... or #token)
  const [tokenLookupInput, setTokenLookupInput] = useState('');
  const [qrScanOpen, setQrScanOpen] = useState(false);
  const qrVideoRef = useRef<HTMLVideoElement>(null);
  const qrStreamRef = useRef<MediaStream | null>(null);

  const isStaffDark = mode === 'barber_staff';

  useEffect(() => {
    return () => {
      if (qrStreamRef.current) {
        for (const track of qrStreamRef.current.getTracks()) {
          track.stop();
        }
        qrStreamRef.current = null;
      }
    };
  }, []);

  function stopTokenQrScanner() {
    if (qrStreamRef.current) {
      for (const track of qrStreamRef.current.getTracks()) {
        track.stop();
      }
      qrStreamRef.current = null;
    }
    setQrScanOpen(false);
  }

  async function startTokenQrScanner() {
    setErrorMessage(null);
    const DetectorCtor = (
      window as unknown as {
        BarcodeDetector?: new (opts?: { formats?: string[] }) => {
          detect(src: HTMLVideoElement): Promise<Array<{ rawValue?: string }>>;
        };
      }
    ).BarcodeDetector;

    if (!navigator.mediaDevices?.getUserMedia || !DetectorCtor) {
      setErrorMessage(
        'Live camera QR scanning is unsupported on this browser — type #Token (e.g. #2) above.',
      );
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      qrStreamRef.current = stream;
      setQrScanOpen(true);

      const detector = new DetectorCtor({ formats: ['qr_code'] });
      let active = true;

      const scanFrame = async () => {
        if (!active || !qrStreamRef.current || !qrVideoRef.current) return;
        try {
          const codes = await detector.detect(qrVideoRef.current);
          const raw = codes[0]?.rawValue?.trim();
          if (raw) {
            setTokenLookupInput(raw);
            stopTokenQrScanner();
            active = false;
            return;
          }
        } catch {
          // frame read skipped
        }
        if (active && qrStreamRef.current) {
          window.setTimeout(() => void scanFrame(), 320);
        }
      };

      window.setTimeout(() => {
        if (qrVideoRef.current) {
          qrVideoRef.current.srcObject = stream;
          void qrVideoRef.current.play().then(() => void scanFrame());
        }
      }, 60);
    } catch {
      setErrorMessage('Camera permission declined. Enter the guest #Token manually.');
    }
  }

  function handleExportLedgerCsv() {
    if (!revenueSummary) return;
    const isToday = revenueRange === 'today';
    const rows = [
      ['Service', 'Cuts Done', 'Revenue (INR)'],
      ...revenueSummary.serviceBreakdown
        .filter((r) => (isToday ? r.countToday > 0 : r.countMonth > 0))
        .map((r) => [
          r.serviceName,
          String(isToday ? r.countToday : r.countMonth),
          ((isToday ? r.revenueTodayPaise : r.revenueMonthPaise) / 100).toFixed(2),
        ]),
    ];
    const csv = rows
      .map((line) => line.map((v) => `"${v.replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${business.slug}-ledger-${isToday ? getTodayQueueDateKey() : selectedMonthKey}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(url), 4000);
    notifyStatus('Exported ledger CSV.');
  }

  const queueUrl = getBarberQueueUrl(business.slug);
  const barberStaffUrl = getBarberStaffUrl(business.slug);

  function notifyStatus(msg: string) {
    setErrorMessage(null);
    setStatusMessage(msg);
    window.setTimeout(() => {
      setStatusMessage((prev) => (prev === msg ? null : prev));
    }, 4500);
  }

  const refreshQueue = useCallback(
    async (syncConfigFields = false) => {
      try {
        const data = await businessRepository.getPublicBarberQueueStatus(
          business.slug,
        );
        if (data) {
          setQueueData(data);
          if (syncConfigFields) {
            setAvgServiceMinutes(data.config.avgServiceMinutes);
            setMaxQueueSize(data.config.maxQueueSize);
            setAwardStarOnCompletion(data.config.awardStarOnCompletion);
            setServicesDraft(data.config.services);
            if (data.config.services.length > 0) {
              setWalkInService(data.config.services[0].name);
            }
          }
        } else if (mode === 'owner') {
          // Preview fallback when business is still pending approval
          const cfg = await businessRepository.getBarberQueueConfig(
            business.id,
          );
          setQueueData({
            business: {
              id: business.id,
              slug: business.slug,
              name: business.name,
              category: business.category,
              city: business.city,
              googleReviewUrl: business.googleReviewUrl,
            },
            config: cfg,
            nowServing: null,
            waitingTickets: [],
            waitingCount: 0,
            estimatedWaitForNewGuestMinutes: 0,
            completedTodayCount: 0,
            rewards: [],
          });
          if (syncConfigFields) {
            setAvgServiceMinutes(cfg.avgServiceMinutes);
            setMaxQueueSize(cfg.maxQueueSize);
            setAwardStarOnCompletion(cfg.awardStarOnCompletion);
            setServicesDraft(cfg.services);
            if (cfg.services.length > 0) {
              setWalkInService(cfg.services[0].name);
            }
          }
        }
      } catch (err) {
        setErrorMessage((err as Error).message);
      } finally {
        setLoading(false);
      }
      if (mode === 'owner') {
        try {
          const rev =
            await businessRepository.getBarberRevenueAndServiceSummary(
              business.id,
              selectedMonthKey,
            );
          setRevenueSummary(rev);
        } catch {
          // non-blocking ledger refresh
        }
      }
    },
    [business, mode, selectedMonthKey],
  );

  useEffect(() => {
    let active = true;
    const initTimer = window.setTimeout(() => {
      if (active) {
        void refreshQueue(true);
      }
    }, 0);
    const timer = window.setInterval(() => {
      void refreshQueue(false);
    }, 8000);
    return () => {
      active = false;
      window.clearTimeout(initTimer);
      window.clearInterval(timer);
    };
  }, [refreshQueue]);

  useEffect(() => {
    if (mode !== 'owner' || !showQrStudio || !qrCanvasRef.current) return;
    const base = loadBusinessQRSettings(business);
    void renderQrPosterToCanvas(
      qrCanvasRef.current,
      business,
      {
        ...base,
        template: 'table_standee',
        heading: 'Scan for Live Wait Time & Queue Token',
        instruction:
          'Check current wait time, grab a token & earn Loyalty Stars',
      },
      {
        targetUrl: queueUrl,
        customSteps: [
          '1. Scan this QR code at the entrance or barber mirror',
          '2. See live wait time & join the walk-in queue in 1 tap',
          '3. Step out freely — your countdown updates live on your phone',
        ],
      },
    );
  }, [mode, showQrStudio, business, queueUrl]);

  async function handleBroadcastDelay(addMinutes: BarberQueueDelayIncrement) {
    setExtendingMins(addMinutes);
    setErrorMessage(null);
    try {
      const res = await businessRepository.barberExtendQueueTimer({
        businessSlug: business.slug,
        addMinutes,
        staffPinHash,
      });
      await refreshQueue(false);
      notifyStatus(
        res.updatedCount > 0
          ? `⏱ Broadcasted +${addMinutes} mins delay to ${res.updatedCount} waiting guest${res.updatedCount === 1 ? '' : 's'}!`
          : `No waiting guests in line right now (+${addMinutes}m not needed).`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setExtendingMins(null);
    }
  }

  async function handleAdvanceTicket(
    ticketId: string,
    nextStatus: BarberQueueTicketStatus,
  ) {
    setBusyTicketId(ticketId);
    setErrorMessage(null);
    try {
      const res = await businessRepository.barberAdvanceQueueTicket({
        businessSlug: business.slug,
        ticketId,
        status: nextStatus,
        staffLabel,
        staffPinHash,
      });
      await refreshQueue(false);
      if (nextStatus === 'in_chair') {
        notifyStatus(
          `Called Token #${res.ticket.tokenNumber} (${res.ticket.guestName}) to the chair!`,
        );
      } else if (nextStatus === 'completed') {
        notifyStatus(
          res.starAwarded
            ? `Completed Token #${res.ticket.tokenNumber} (${res.ticket.guestName}) — credited +${res.starsAwarded} ★ Loyalty Star! (Balance: ${res.newLoyaltyStarsBalance} ★)`
            : `Completed Token #${res.ticket.tokenNumber} (${res.ticket.guestName}) ✓`,
        );
      } else if (nextStatus === 'no_show') {
        notifyStatus(
          `Marked Token #${res.ticket.tokenNumber} (${res.ticket.guestName}) as No-Show.`,
        );
      } else {
        notifyStatus(`Updated Token #${res.ticket.tokenNumber} status.`);
      }
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setBusyTicketId(null);
    }
  }

  async function handleToggleQueueOpen() {
    if (mode !== 'owner' || !queueData) return;
    setTogglingOpen(true);
    setErrorMessage(null);
    try {
      const nextOpen = !queueData.config.isQueueOpen;
      await businessRepository.updateBarberQueueConfig(business.id, {
        isQueueOpen: nextOpen,
        avgServiceMinutes: queueData.config.avgServiceMinutes,
        maxQueueSize: queueData.config.maxQueueSize,
        awardStarOnCompletion: queueData.config.awardStarOnCompletion,
        services: queueData.config.services,
      });
      await refreshQueue(true);
      notifyStatus(
        nextOpen
          ? 'Walk-In Queue is now OPEN and accepting guests!'
          : 'Walk-In Queue is PAUSED (new joins blocked).',
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setTogglingOpen(false);
    }
  }

  async function handleAddEntry(e: React.FormEvent) {
    e.preventDefault();
    const bookingType: BarberBookingType = entryFormMode ?? 'walk_in';
    setAddingWalkIn(true);
    setErrorMessage(null);
    try {
      const res = await businessRepository.joinBarberQueue({
        businessSlug: business.slug,
        guestName: walkInName.trim(),
        phone: walkInPhone.trim() || null,
        serviceName: walkInService,
        bookingType,
        scheduledTime: bookingType === 'appointment' ? apptSlotTime : null,
      });
      const code = formatTicketDisplayCode(res.ticket);
      setWalkInName('');
      setWalkInPhone('');
      setEntryFormMode(null);
      await refreshQueue(false);
      notifyStatus(
        bookingType === 'appointment'
          ? `Booked ${res.ticket.guestName} as ${code} for ${formatTimeSlot12h(res.ticket.scheduledTime)} (merged fairly into queue).`
          : `Added ${res.ticket.guestName} as Walk-In ${code} (~${res.estimatedWaitMinutes} mins wait).`,
      );
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setAddingWalkIn(false);
    }
  }

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!queueData) return;
    setSavingConfig(true);
    setErrorMessage(null);
    try {
      await businessRepository.updateBarberQueueConfig(business.id, {
        isQueueOpen: queueData.config.isQueueOpen,
        avgServiceMinutes,
        maxQueueSize,
        awardStarOnCompletion,
        services: servicesDraft,
      });
      await refreshQueue(true);
      setShowSettings(false);
      notifyStatus('Saved Live Queue settings & services.');
    } catch (err) {
      setErrorMessage((err as Error).message);
    } finally {
      setSavingConfig(false);
    }
  }

  function handleAddServiceDraft() {
    const clean = newSvcName.trim();
    if (!clean) return;
    const parsedPrice = Math.max(
      0,
      Math.round(Number.parseFloat(newSvcPriceRupees || '0') * 100),
    );
    const id = clean
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    setServicesDraft((prev) => [
      ...prev,
      {
        id: id || `svc-${prev.length + 1}`,
        name: clean,
        durationMinutes: Math.max(5, Math.min(240, newSvcMins)),
        pricePaise: Number.isFinite(parsedPrice) ? parsedPrice : 20000,
      },
    ]);
    setNewSvcName('');
    setNewSvcMins(20);
    setNewSvcPriceRupees('200');
  }

  async function handleCopyQueueUrl() {
    const ok = await copyText(queueUrl);
    if (ok) {
      setCopiedQueueUrl(true);
      window.setTimeout(() => setCopiedQueueUrl(false), 2000);
    }
  }

  function handleDownloadQueueQrPng() {
    if (!qrCanvasRef.current) return;
    const pngUrl = qrCanvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${business.slug}-live-queue-qr.png`;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    notifyStatus(`Downloaded PNG Standee (${business.slug}-live-queue-qr.png).`);
  }

  function handleDownloadQueueQrPdf() {
    if (!qrCanvasRef.current) return;
    const pdfBlob = generatePrintablePdfBlobFromCanvas(qrCanvasRef.current);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const link = document.createElement('a');
    link.download = `${business.slug}-live-queue-qr.pdf`;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    notifyStatus(
      `Downloaded Printable A5 PDF (${business.slug}-live-queue-qr.pdf).`,
    );
  }

  if (loading && !queueData) {
    return (
      <div className="bistro-card p-10 text-center">
        <div className="inline-block h-7 w-7 animate-spin rounded-full border-4 border-[#1E1B4B] border-r-transparent" />
        <p className="mt-3 text-[14px] font-medium text-[#6B7280]">
          Loading Live Queue Controller…
        </p>
      </div>
    );
  }

  const config = queueData?.config;
  const nowServing = queueData?.nowServing ?? null;
  const waitingTickets = queueData?.waitingTickets ?? [];
  const completedTodayCount = queueData?.completedTodayCount ?? 0;

  return (
    <div className="space-y-5 animate-fadeSlideUp">
      {/* Status & Error Toasts */}
      {statusMessage && (
        <div
          role="status"
          className="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] font-bold text-[#059669]"
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

      {/* Owner Header Bar */}
      {mode === 'owner' && (
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2.5">
              <h1 className="text-[28px] sm:text-[32px] font-extrabold tracking-tight text-[#111827]">
                Live Queue Timer
              </h1>
              <span
                className={`rounded-full border px-3 py-0.5 text-[11px] font-extrabold uppercase tracking-wider ${
                  config?.isQueueOpen
                    ? 'border-emerald-200 bg-emerald-50 text-[#059669]'
                    : 'border-amber-300 bg-amber-50 text-[#D97706]'
                }`}
              >
                {config?.isQueueOpen ? 'QUEUE OPEN' : 'QUEUE PAUSED'}
              </span>
            </div>
            <div className="mt-1.5 flex flex-wrap items-center gap-4 text-[13px] font-semibold text-[#6B7280]">
              <span>{business.name}</span>
              {isBusinessLive && (
                <>
                  <a
                    href={queueUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                  >
                    Customer Live Queue <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                  <a
                    href={barberStaffUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[#1E1B4B] hover:underline"
                  >
                    Barber Chair Mobile App <ExternalLink className="h-3.5 w-3.5" aria-hidden />
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowQrStudio((v) => !v)}
              className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3.5 text-[13px] font-bold text-[#1E1B4B] hover:bg-[#F8F9FA] cursor-pointer"
            >
              <QrCode className="h-4 w-4" aria-hidden />
              {showQrStudio ? 'Hide Queue QR' : 'Live Queue QR Standee'}
            </button>

            <button
              type="button"
              role="switch"
              aria-checked={Boolean(config?.isQueueOpen)}
              disabled={togglingOpen}
              onClick={() => void handleToggleQueueOpen()}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-extrabold transition-all cursor-pointer ${
                config?.isQueueOpen
                  ? 'bg-[#059669] text-[#FFFFFF] hover:bg-emerald-700'
                  : 'bg-[#D97706] text-[#FFFFFF] hover:bg-amber-700'
              }`}
            >
              {config?.isQueueOpen ? 'Pause Queue' : 'Open Queue'}
            </button>
          </div>
        </div>
      )}

      {/* ==================== ZONE 1: COMPACT TOP DELAY & STATUS STRIP ==================== */}
      <div
        className={`rounded-3xl border p-4 sm:p-5 shadow-xs space-y-3 ${
          isStaffDark
            ? 'border-[#303239] bg-[#17181C] text-[#F5F5F6]'
            : 'border-[#E4E5E8] bg-[#FFFFFF] text-[#18191C]'
        }`}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <Clock className="h-4 w-4 text-[#D5A63C]" aria-hidden />
            <p
              className={`text-[12px] font-extrabold uppercase tracking-[0.14em] ${
                isStaffDark ? 'text-[#F5F5F6]' : 'text-[#18191C]'
              }`}
            >
              1-Tap Timer Broadcast
            </p>
            <span
              className={`text-[12px] hidden sm:inline ${
                isStaffDark ? 'text-[#B5B5BC]' : 'text-[#5D626A]'
              }`}
            >
              — Updates all waiting customer phones live
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-[12px] font-extrabold tabular-nums ${
                isStaffDark
                  ? 'border-[#D5A63C]/40 bg-[#202127] text-[#F2C45B]'
                  : 'border-[#D5A63C]/40 bg-[#F5F6F8] text-[#18191C]'
              }`}
            >
              {completedTodayCount} Cuts Done Today
            </span>
            <button
              type="button"
              onClick={() => void refreshQueue(false)}
              aria-label="Sync queue"
              className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border cursor-pointer ${
                isStaffDark
                  ? 'border-[#303239] bg-[#202127] text-[#F5F5F6] hover:border-[#D5A63C]'
                  : 'border-[#E4E5E8] bg-[#F5F6F8] text-[#18191C] hover:border-[#D5A63C]'
              }`}
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
          {ALLOWED_QUEUE_DELAY_INCREMENTS.map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={extendingMins !== null}
              onClick={() => void handleBroadcastDelay(mins)}
              className="flex h-12 items-center justify-center gap-1.5 rounded-2xl border border-[#D5A63C]/35 bg-[#101114] px-3 text-[#F5F5F6] shadow-2xs hover:bg-[#202127] active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer"
            >
              <span className="text-[15px] font-black text-[#F2C45B] tabular-nums">
                +{mins}m
              </span>
              <span className="text-[10px] font-semibold text-[#B5B5BC] hidden sm:inline">
                {extendingMins === mins ? '…' : 'Send'}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Printable Live Queue QR Standee Drawer (Owner mode) */}
      {mode === 'owner' && showQrStudio && (
        <div className="bistro-card p-6 space-y-5 animate-fadeSlideUp">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E1B4B]/10 pb-4">
            <div>
              <h2 className="text-[18px] font-extrabold text-[#111827] flex items-center gap-2">
                <QrCode className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
                Live Queue &amp; Wait-Time QR Standee
              </h2>
              <p className="text-[13px] text-[#6B7280] mt-0.5 font-mono break-all">
                {queueUrl}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="secondary"
                onClick={() => void handleCopyQueueUrl()}
              >
                {copiedQueueUrl ? (
                  <Check className="h-4 w-4 text-[#059669]" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copiedQueueUrl ? 'Copied' : 'Copy Queue Link'}
              </Button>
              <Button
                type="button"
                variant="primary"
                onClick={handleDownloadQueueQrPng}
              >
                <Download className="h-4 w-4" aria-hidden /> PNG
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={handleDownloadQueueQrPdf}
              >
                <FileText className="h-4 w-4" aria-hidden /> A5 PDF
              </Button>
            </div>
          </div>

          <div className="flex justify-center rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-5">
            <canvas
              ref={qrCanvasRef}
              aria-label={`Live Queue QR Standee for ${business.name}`}
              className="w-full max-w-[300px] rounded-xl shadow-md bg-[#FFFFFF]"
            />
          </div>
        </div>
      )}

      {/* ==================== ZONE 2: FULL-WIDTH "CURRENTLY IN CHAIR" HERO BAR ==================== */}
      <section
        aria-label="Currently In Chair"
        className="overflow-hidden rounded-3xl border border-[#C89B3C]/45 bg-[#111318] text-[#FAF8F5] shadow-md"
      >
        <div className="h-1.5 w-full bg-gradient-to-r from-[#C89B3C] via-[#F3E3B8] to-[#C89B3C]" />
        <div className="p-5 sm:p-6">
          {nowServing ? (
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div className="flex items-start gap-4 min-w-0">
                <span className="flex h-16 min-w-16 px-3 shrink-0 items-center justify-center rounded-2xl border border-[#C89B3C]/50 bg-[#1B1F27] text-[22px] font-black text-[#F3E3B8] tabular-nums">
                  {formatTicketDisplayCode(nowServing)}
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-[#C89B3C] px-2.5 py-0.5 text-[10.5px] font-black uppercase tracking-wider text-[#111318]">
                      <Scissors className="h-3 w-3" aria-hidden />
                      Currently In Chair
                    </span>
                    <span className="rounded-full border border-white/15 bg-white/5 px-2.5 py-0.5 text-[11px] font-bold text-[#F3E3B8] tabular-nums">
                      ~{nowServing.remainingMinutes ?? nowServing.durationMinutes}m left
                    </span>
                    {nowServing.bookingType === 'appointment' &&
                      nowServing.scheduledTime && (
                        <span className="rounded-full bg-[#F3E3B8]/20 px-2.5 py-0.5 text-[11px] font-bold text-[#F3E3B8]">
                          Booked {formatTimeSlot12h(nowServing.scheduledTime)}
                        </span>
                      )}
                  </div>
                  <p className="text-[22px] leading-tight font-black text-[#FFFFFF] truncate">
                    {nowServing.guestName}
                  </p>
                  <p className="text-[13px] font-semibold text-[#A3A8B3]">
                    {nowServing.serviceName}
                    {typeof nowServing.pricePaise === 'number' &&
                    nowServing.pricePaise > 0
                      ? ` • ${formatPriceFromPaise(nowServing.pricePaise, 'INR')}`
                      : ''}{' '}
                    • {nowServing.durationMinutes}m
                    {nowServing.assignedBarberLabel
                      ? ` • ${nowServing.assignedBarberLabel}`
                      : ''}
                  </p>
                </div>
                {nowServing.assignedBarberLabel && (
                  <img
                    src={resolveBarberPortrait(nowServing.assignedBarberLabel)}
                    alt={nowServing.assignedBarberLabel}
                    className="hidden sm:block h-10 w-10 shrink-0 rounded-full object-cover border border-[#D5A63C]/45"
                    loading="lazy"
                  />
                )}
              </div>

              <button
                type="button"
                disabled={busyTicketId === nowServing.id}
                onClick={() =>
                  void handleAdvanceTicket(nowServing.id, 'completed')
                }
                className="flex min-h-14 shrink-0 items-center justify-center gap-2 rounded-2xl bg-[#10B981] px-6 py-3.5 text-[15px] font-black text-[#FFFFFF] shadow-lg hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                {busyTicketId === nowServing.id
                  ? 'Completing…'
                  : `Complete Cut${
                      typeof nowServing.pricePaise === 'number' &&
                      nowServing.pricePaise > 0
                        ? ` & Log ${formatPriceFromPaise(nowServing.pricePaise, 'INR')}`
                        : ''
                    }${
                      config?.awardStarOnCompletion && nowServing.customerId
                        ? ' (+1 ★)'
                        : ''
                    } ✓`}
              </button>
            </div>
          ) : (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-3.5">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl border border-[#C89B3C]/35 bg-[#1B1F27] text-[#C89B3C]">
                  <Scissors className="h-6 w-6" aria-hidden />
                </span>
                <div>
                  <p className="text-[17px] font-black text-[#FFFFFF]">
                    Barber Chair is Open &amp; Ready
                  </p>
                  <p className="text-[12.5px] text-[#A3A8B3]">
                    Tap &ldquo;Call to Chair →&rdquo; on the next waiting guest or add a walk-in / phone appointment below.
                  </p>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/30 bg-emerald-500/15 px-3 py-1 text-[11.5px] font-extrabold text-emerald-300">
                Daily tokens reset cleanly to #1 every morning
              </span>
            </div>
          )}
        </div>
      </section>

      {/* ==================== ZONE 3: FULL-WIDTH UNIFIED HYBRID QUEUE ==================== */}
      <section
        aria-label="Unified Walk-In and Appointment Queue"
        className={`rounded-3xl border p-5 sm:p-6 shadow-xs space-y-4 ${
          isStaffDark
            ? 'border-[#303239] bg-[#17181C] text-[#F5F5F6]'
            : 'border-[#E4E5E8] bg-[#FFFFFF] text-[#18191C]'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2.5">
            <h2
              className={`text-[18px] font-black flex items-center gap-2 ${
                isStaffDark ? 'text-[#F5F5F6]' : 'text-[#18191C]'
              }`}
            >
              <Users className="h-5 w-5 text-[#D5A63C]" aria-hidden />
              Unified Queue (Walk-Ins + Booked Slots)
            </h2>
            <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#101114] border border-[#D5A63C]/40 px-2 text-[12px] font-bold text-[#F2C45B] tabular-nums">
              {waitingTickets.length}
            </span>
          </div>

          {/* Two Prominent Action Buttons Side-by-Side */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() =>
                setEntryFormMode((prev) =>
                  prev === 'walk_in' ? null : 'walk_in',
                )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#101114] border border-[#303239] px-4 text-[13px] font-extrabold text-[#F5F5F6] hover:bg-[#202127] cursor-pointer"
            >
              <UserPlus className="h-4 w-4 text-[#F2C45B]" aria-hidden />
              + Add Walk-In
            </button>

            <button
              type="button"
              onClick={() =>
                setEntryFormMode((prev) =>
                  prev === 'appointment' ? null : 'appointment',
                )
              }
              className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#D5A63C] px-4 text-[13px] font-extrabold text-[#101114] hover:bg-[#F2C45B] cursor-pointer"
            >
              <CalendarClock className="h-4 w-4" aria-hidden />
              + Phone / Online Slot
            </button>
          </div>
        </div>

        {/* Walk-In OR Phone/Online Appointment Entry Drawer */}
        {entryFormMode && (
          <form
            onSubmit={(e) => void handleAddEntry(e)}
            className={`rounded-2xl border-2 p-4 space-y-3 animate-fadeSlideUp ${
              entryFormMode === 'appointment'
                ? 'border-[#C89B3C] bg-[#F3E3B8]/25'
                : 'border-[#111318]/20 bg-[#FFFFFF]'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[13.5px] font-black text-[#111318]">
                {entryFormMode === 'appointment'
                  ? '📅 Book Phone / Online Time Slot (B-XX — Fairly Merged Into Queue)'
                  : '🚶 Issue Instant Walk-In Token (W-XX)'}
              </p>
            </div>
            <div
              className={`grid gap-3 ${
                entryFormMode === 'appointment'
                  ? 'sm:grid-cols-2 lg:grid-cols-4'
                  : 'sm:grid-cols-3'
              }`}
            >
              <input
                type="text"
                required
                maxLength={80}
                placeholder="Customer Name (e.g. Suresh)"
                value={walkInName}
                onChange={(e) => setWalkInName(e.target.value)}
                className="h-10 rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111318] focus:border-[#111318] focus:outline-none"
              />
              <input
                type="tel"
                maxLength={40}
                placeholder="Phone (Optional, for ★)"
                value={walkInPhone}
                onChange={(e) => setWalkInPhone(e.target.value)}
                className="h-10 rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111318] focus:border-[#111318] focus:outline-none"
              />
              <select
                value={walkInService}
                onChange={(e) => setWalkInService(e.target.value)}
                className="h-10 rounded-xl border border-[#111318]/20 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111318] focus:border-[#111318] focus:outline-none"
              >
                {(config?.services ?? []).map((svc) => (
                  <option key={svc.id} value={svc.name}>
                    {svc.name} ({svc.durationMinutes}m ·{' '}
                    {formatPriceFromPaise(svc.pricePaise, 'INR')})
                  </option>
                ))}
              </select>
              {entryFormMode === 'appointment' && (
                <select
                  aria-label="Appointment Time Slot"
                  value={apptSlotTime}
                  onChange={(e) => setApptSlotTime(e.target.value)}
                  className="h-10 rounded-xl border border-[#C89B3C] bg-[#FFFFFF] px-3 text-[13px] font-extrabold text-[#111318] focus:border-[#111318] focus:outline-none"
                >
                  {BOOKABLE_TIME_SLOTS.map((slot) => {
                    const taken = (queueData?.bookedSlotsToday ?? []).includes(
                      slot.value,
                    );
                    return (
                      <option
                        key={slot.value}
                        value={slot.value}
                        disabled={taken}
                      >
                        {slot.label} {taken ? '(Booked)' : ''}
                      </option>
                    );
                  })}
                </select>
              )}
            </div>
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setEntryFormMode(null)}
              >
                Cancel
              </Button>
              <button
                type="submit"
                disabled={addingWalkIn}
                className="inline-flex h-10 items-center justify-center rounded-xl bg-[#111318] px-5 text-[13px] font-extrabold text-[#F3E3B8] hover:bg-[#1F232C] disabled:opacity-60 cursor-pointer"
              >
                {addingWalkIn
                  ? 'Saving…'
                  : entryFormMode === 'appointment'
                    ? `Reserve ${formatTimeSlot12h(apptSlotTime)} Slot`
                    : 'Issue Walk-In Token'}
              </button>
            </div>
          </form>
        )}

        {/* Customer Personal Token QR / #Number Quick Check-In */}
        {(waitingTickets.length > 0 || nowServing) && (() => {
          const parsed = parseBarberQueueTicketQr(tokenLookupInput);
          const allActive = [...(nowServing ? [nowServing] : []), ...waitingTickets];
          const matched = parsed
            ? allActive.find(
                (t) =>
                  (parsed.ticketId && t.id === parsed.ticketId) ||
                  (parsed.tokenNumber !== undefined &&
                    t.tokenNumber === parsed.tokenNumber),
              ) ?? null
            : null;
          return (
            <div
              className={`rounded-2xl border p-3 space-y-2.5 ${
                isStaffDark
                  ? 'border-[#303239] bg-[#101114] text-[#F5F5F6]'
                  : 'border-[#E4E5E8] bg-[#F5F6F8] text-[#18191C]'
              }`}
            >
              <div className="flex items-center gap-2">
                <ScanLine
                  className="h-4 w-4 shrink-0 text-[#D5A63C]"
                  aria-hidden
                />
                <input
                  type="text"
                  value={tokenLookupInput}
                  onChange={(e) => setTokenLookupInput(e.target.value)}
                  placeholder="Check in Personal Token QR or enter #Token (e.g. #2)…"
                  aria-label="Scan or enter customer Token QR"
                  className={`w-full bg-transparent text-[13px] font-semibold placeholder:text-[#8E939D] focus:outline-none ${
                    isStaffDark ? 'text-[#F5F5F6]' : 'text-[#18191C]'
                  }`}
                />
                <button
                  type="button"
                  onClick={() =>
                    qrScanOpen ? stopTokenQrScanner() : void startTokenQrScanner()
                  }
                  className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg border border-[#D5A63C]/40 bg-[#101114] px-2.5 text-[11px] font-bold text-[#F2C45B] cursor-pointer"
                >
                  {qrScanOpen ? (
                    <>
                      <X className="h-3.5 w-3.5" aria-hidden /> Close
                    </>
                  ) : (
                    <>
                      <Camera className="h-3.5 w-3.5" aria-hidden /> Scan QR
                    </>
                  )}
                </button>
                {tokenLookupInput && (
                  <button
                    type="button"
                    onClick={() => setTokenLookupInput('')}
                    className="text-[11px] font-bold text-[#B5B5BC] hover:text-[#D5A63C] cursor-pointer"
                  >
                    Clear
                  </button>
                )}
              </div>
              {qrScanOpen && (
                <div className="mx-auto max-w-xs overflow-hidden rounded-xl border border-[#D5A63C]/50 bg-black">
                  <video ref={qrVideoRef} playsInline muted className="h-44 w-full object-cover" />
                </div>
              )}
              {tokenLookupInput.trim() && (
                matched ? (
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#C89B3C]/50 bg-[#F3E3B8]/40 px-3 py-2">
                    <div className="text-[12.5px] font-bold text-[#111318]">
                      Verified {formatTicketDisplayCode(matched)} · {matched.guestName} ({matched.serviceName})
                    </div>
                    <button
                      type="button"
                      disabled={busyTicketId === matched.id}
                      onClick={() => {
                        void handleAdvanceTicket(
                          matched.id,
                          matched.status === 'in_chair' ? 'completed' : 'in_chair',
                        );
                        setTokenLookupInput('');
                      }}
                      className="inline-flex h-8 items-center gap-1 rounded-lg bg-[#111318] px-3 text-[11.5px] font-extrabold text-[#F3E3B8] hover:bg-[#1F232C] cursor-pointer"
                    >
                      {matched.status === 'in_chair'
                        ? 'Complete Cut ✓'
                        : 'Seat in Chair →'}
                    </button>
                  </div>
                ) : (
                  <p className="text-[12px] font-semibold text-amber-800">
                    No active waiting or in-chair token matched &ldquo;{tokenLookupInput.trim()}&rdquo;.
                  </p>
                )
              )}
            </div>
          );
        })()}

        {waitingTickets.length === 0 ? (
          <div
            className={`rounded-2xl border border-dashed p-7 text-center space-y-2.5 ${
              isStaffDark
                ? 'border-[#303239] bg-[#101114] text-[#F5F5F6]'
                : 'border-[#E4E5E8] bg-[#F5F6F8] text-[#18191C]'
            }`}
          >
            <img
              src={BARBER_UI_MEDIA.icons.chair}
              alt="Empty barber chair queue illustration"
              className="mx-auto h-16 w-16 rounded-2xl object-cover border border-[#D5A63C]/30"
              loading="lazy"
            />
            <p className="text-[15px] font-extrabold">
              No one waiting in line right now
            </p>
            <p
              className={`mx-auto max-w-md text-[12.5px] ${
                isStaffDark ? 'text-[#B5B5BC]' : 'text-[#5D626A]'
              }`}
            >
              Walk-ins (W-01) and booked slots (B-01) weave together automatically in chronological order.
            </p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {waitingTickets.map((ticket, idx) => {
              const isBusy = busyTicketId === ticket.id;
              const isUpNext = idx === 0;
              const isAppt = ticket.bookingType === 'appointment';
              const displayCode = formatTicketDisplayCode(ticket);
              return (
                <div
                  key={ticket.id}
                  className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                    isAppt
                      ? 'border-[#C89B3C] bg-[#F3E3B8]/30'
                      : isUpNext
                        ? 'border-[#111318]/40 bg-[#FFFFFF] shadow-xs'
                        : 'border-[#111318]/12 bg-[#FFFFFF]'
                  }`}
                >
                  <div className="flex items-center gap-3.5 min-w-0">
                    <span
                      className={`flex h-12 min-w-14 px-2 shrink-0 items-center justify-center rounded-2xl font-black text-[15px] tabular-nums ${
                        isAppt
                          ? 'bg-[#C89B3C] text-[#111318]'
                          : isUpNext
                            ? 'bg-[#111318] text-[#F3E3B8]'
                            : 'bg-[#FAF8F5] border border-[#111318]/15 text-[#111318]'
                      }`}
                    >
                      {displayCode}
                    </span>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[15px] font-extrabold text-[#111318] truncate">
                          {ticket.guestName}
                        </p>
                        {isAppt ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-[#C89B3C] px-2.5 py-0.5 text-[10.5px] font-black uppercase text-[#111318]">
                            Booked{' '}
                            {formatTimeSlot12h(ticket.scheduledTime) || 'Slot'} ·{' '}
                            {displayCode}
                          </span>
                        ) : (
                          <span className="rounded-full bg-[#111318] px-2.5 py-0.5 text-[10.5px] font-extrabold uppercase text-[#F3E3B8]">
                            Walk-In · {displayCode}
                          </span>
                        )}
                        {isUpNext && (
                          <span className="rounded-full bg-emerald-100 border border-emerald-300 px-2 py-0.5 text-[10px] font-extrabold uppercase text-emerald-900">
                            Up Next
                          </span>
                        )}
                        {ticket.extraDelayMinutes > 0 && (
                          <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-[#D97706]">
                            +{ticket.extraDelayMinutes}m delay
                          </span>
                        )}
                      </div>
                      <p className="text-[12.5px] font-semibold text-[#5C6068] tabular-nums mt-0.5">
                        {ticket.serviceName} ({ticket.durationMinutes}m
                        {typeof ticket.pricePaise === 'number' &&
                        ticket.pricePaise > 0
                          ? ` · ${formatPriceFromPaise(ticket.pricePaise, 'INR')}`
                          : ''}
                        ) • Est. wait:{' '}
                        <strong className="text-[#111318]">
                          ~{ticket.estimatedWaitMinutes ?? 0} mins
                        </strong>
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void handleAdvanceTicket(ticket.id, 'in_chair')
                      }
                      className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#111318] px-4 text-[12.5px] font-extrabold text-[#FAF8F5] hover:bg-[#1F232C] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                    >
                      <Play className="h-3.5 w-3.5 text-[#F3E3B8]" aria-hidden />
                      Call to Chair →
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() =>
                        void handleAdvanceTicket(ticket.id, 'no_show')
                      }
                      className="inline-flex h-10 items-center gap-1 rounded-xl border border-red-200 bg-red-50 px-3 text-[12px] font-bold text-red-700 hover:bg-red-100 cursor-pointer"
                    >
                      <UserX className="h-3.5 w-3.5" aria-hidden />
                      No-Show
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* ==================== DAILY & MONTHLY HAIRCUT & SERVICE REVENUE REPORT ==================== */}
      {mode === 'owner' && (
        <section
          aria-label="Daily and Monthly Haircut and Revenue Report"
          className="rounded-3xl border border-[#111318]/12 bg-[#FFFFFF] p-5 sm:p-6 shadow-xs space-y-5"
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-[19px] font-black text-[#111318] flex items-center gap-2">
                <TrendingUp className="h-5 w-5 text-[#C89B3C]" aria-hidden />
                Daily &amp; Monthly Haircut &amp; Revenue Ledger
              </h2>
              <p className="text-[12.5px] text-[#5C6068] mt-0.5">
                Every completed cut logs its exact service type &amp; fixed price automatically. Tokens reset cleanly to #1 tomorrow morning.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex rounded-xl border border-[#111318]/15 bg-[#FAF8F5] p-1">
                <button
                  type="button"
                  onClick={() => setRevenueRange('today')}
                  className={`h-8 rounded-lg px-3 text-[12px] font-extrabold transition-all cursor-pointer ${
                    revenueRange === 'today'
                      ? 'bg-[#111318] text-[#F3E3B8]'
                      : 'text-[#5C6068] hover:text-[#111318]'
                  }`}
                >
                  Today
                </button>
                <button
                  type="button"
                  onClick={() => setRevenueRange('month')}
                  className={`h-8 rounded-lg px-3 text-[12px] font-extrabold transition-all cursor-pointer ${
                    revenueRange === 'month'
                      ? 'bg-[#111318] text-[#F3E3B8]'
                      : 'text-[#5C6068] hover:text-[#111318]'
                  }`}
                >
                  This Month
                </button>
              </div>

              {revenueRange === 'month' && (
                <input
                  type="month"
                  aria-label="Select ledger month"
                  value={selectedMonthKey}
                  onChange={(e) => setSelectedMonthKey(e.target.value)}
                  className="h-10 rounded-xl border border-[#111318]/15 bg-[#FAF8F5] px-3 text-[12.5px] font-bold text-[#111318]"
                />
              )}
              <button
                type="button"
                disabled={!revenueSummary}
                onClick={handleExportLedgerCsv}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#E4E5E8] bg-[#FFFFFF] px-3 text-[12px] font-bold text-[#18191C] hover:border-[#D5A63C] disabled:opacity-50 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5 text-[#D5A63C]" aria-hidden />
                Export CSV
              </button>
            </div>
          </div>

          {(() => {
            const totalCuts =
              revenueRange === 'today'
                ? (revenueSummary?.todayTotalCuts ?? 0)
                : (revenueSummary?.monthTotalCuts ?? 0);
            const totalRevenuePaise =
              revenueRange === 'today'
                ? (revenueSummary?.todayRevenuePaise ?? 0)
                : (revenueSummary?.monthRevenuePaise ?? 0);
            const walkInsCount =
              revenueRange === 'today'
                ? (revenueSummary?.todayWalkIns ?? 0)
                : (revenueSummary?.monthWalkIns ?? 0);
            const apptsCount =
              revenueRange === 'today'
                ? (revenueSummary?.todayAppointments ?? 0)
                : (revenueSummary?.monthAppointments ?? 0);
            const breakdownRows = (revenueSummary?.serviceBreakdown ?? []).filter(
              (row) =>
                revenueRange === 'today'
                  ? row.countToday > 0
                  : row.countMonth > 0,
            );

            return (
              <>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-[#111318]/10 bg-[#FAF8F5] p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#5C6068]">
                      {revenueRange === 'today'
                        ? 'Cuts Completed Today'
                        : `Cuts in ${selectedMonthKey}`}
                    </p>
                    <p className="mt-1 text-[28px] leading-none font-black text-[#111318] tabular-nums">
                      {totalCuts}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#C89B3C]/40 bg-[#111318] p-4 text-[#FAF8F5]">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#F3E3B8] flex items-center gap-1">
                      <IndianRupee className="h-3 w-3" aria-hidden />
                      {revenueRange === 'today'
                        ? "Today's Service Revenue"
                        : `Monthly Revenue (${selectedMonthKey})`}
                    </p>
                    <p className="mt-1 text-[28px] leading-none font-black text-[#FFFFFF] tabular-nums">
                      {formatPriceFromPaise(totalRevenuePaise, 'INR')}
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[#111318]/10 bg-[#FAF8F5] p-4">
                    <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#5C6068]">
                      Walk-Ins vs. Booked Slots
                    </p>
                    <p className="mt-1 text-[20px] leading-tight font-black text-[#111318] tabular-nums">
                      {walkInsCount} Walk-In · {apptsCount} Booked
                    </p>
                  </div>
                </div>

                {breakdownRows.length === 0 ? (
                  <p className="rounded-2xl border border-dashed border-[#111318]/15 bg-[#FAF8F5] p-5 text-center text-[13px] font-semibold text-[#5C6068]">
                    Complete cuts above to see your live breakdown by service type (Classic Haircut, Beard Trim, Combo).
                  </p>
                ) : (
                  <div className="overflow-x-auto rounded-2xl border border-[#111318]/10">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-[#FAF8F5] border-b border-[#111318]/10 text-[11px] font-extrabold uppercase tracking-wider text-[#5C6068]">
                          <th className="px-4 py-3">Service Type</th>
                          <th className="px-4 py-3 text-right">Cuts Done</th>
                          <th className="px-4 py-3 text-right">Revenue Earned</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#111318]/10 text-[13.5px]">
                        {breakdownRows.map((row) => (
                          <tr key={row.serviceName} className="bg-[#FFFFFF]">
                            <td className="px-4 py-3 font-extrabold text-[#111318]">
                              {row.serviceName}
                            </td>
                            <td className="px-4 py-3 text-right font-bold text-[#5C6068] tabular-nums">
                              {revenueRange === 'today'
                                ? row.countToday
                                : row.countMonth}
                            </td>
                            <td className="px-4 py-3 text-right font-black text-[#111318] tabular-nums">
                              {formatPriceFromPaise(
                                revenueRange === 'today'
                                  ? row.revenueTodayPaise
                                  : row.revenueMonthPaise,
                                'INR',
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            );
          })()}
        </section>
      )}

      {/* Owner Collapsible Services & Queue Rules Settings */}
      {mode === 'owner' && !hideConfigSection && (
        <div className="bistro-card overflow-hidden">
          <button
            type="button"
            onClick={() => setShowSettings((v) => !v)}
            className="flex w-full items-center justify-between px-6 py-4 text-left hover:bg-[#F8F9FA] cursor-pointer"
          >
            <div className="flex items-center gap-2.5">
              <Settings className="h-4.5 w-4.5 text-[#1E1B4B]" aria-hidden />
              <div>
                <p className="text-[15px] font-extrabold text-[#111827]">
                  Services, Durations &amp; Loyalty Star Rules
                </p>
                <p className="text-[12px] text-[#6B7280]">
                  Customize haircuts, beard trims, max queue size ({maxQueueSize}), and auto-star reward on completion.
                </p>
              </div>
            </div>
            {showSettings ? (
              <ChevronUp className="h-4.5 w-4.5 text-[#6B7280]" aria-hidden />
            ) : (
              <ChevronDown className="h-4.5 w-4.5 text-[#6B7280]" aria-hidden />
            )}
          </button>

          {showSettings && (
            <form
              onSubmit={(e) => void handleSaveConfig(e)}
              className="border-t border-[#1E1B4B]/10 p-6 space-y-5"
            >
              <div className="grid gap-4 sm:grid-cols-3">
                <div className="space-y-1">
                  <label
                    htmlFor="avgSvcMins"
                    className="block text-[12.5px] font-bold text-[#111827]"
                  >
                    Default Avg Cut Time (mins)
                  </label>
                  <input
                    id="avgSvcMins"
                    type="number"
                    min={5}
                    max={180}
                    value={avgServiceMinutes}
                    onChange={(e) =>
                      setAvgServiceMinutes(Number(e.target.value) || 20)
                    }
                    className="h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[14px] font-bold text-[#111827]"
                  />
                </div>
                <div className="space-y-1">
                  <label
                    htmlFor="maxQueueCap"
                    className="block text-[12.5px] font-bold text-[#111827]"
                  >
                    Max Waiting Queue Size
                  </label>
                  <input
                    id="maxQueueCap"
                    type="number"
                    min={1}
                    max={200}
                    value={maxQueueSize}
                    onChange={(e) =>
                      setMaxQueueSize(Number(e.target.value) || 25)
                    }
                    className="h-10 w-full rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[14px] font-bold text-[#111827]"
                  />
                </div>
                <div className="flex items-end pb-1">
                  <label className="inline-flex items-center gap-2 text-[13px] font-bold text-[#111827] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={awardStarOnCompletion}
                      onChange={(e) =>
                        setAwardStarOnCompletion(e.target.checked)
                      }
                      className="h-4 w-4 accent-[#1E1B4B]"
                    />
                    Auto-Award +1 ★ on Cut Completion
                  </label>
                </div>
              </div>

              {/* Services List */}
              <div className="space-y-2.5">
                <p className="text-[12px] font-extrabold uppercase tracking-wider text-[#6B7280]">
                  Offered Barber / Salon Services ({servicesDraft.length})
                </p>
                <div className="space-y-2">
                  {servicesDraft.map((svc, idx) => (
                    <div
                      key={`${svc.id}-${idx}`}
                      className="flex items-center justify-between gap-2 rounded-xl border border-[#1E1B4B]/12 bg-[#F8F9FA] px-3.5 py-2.5"
                    >
                      <div>
                        <p className="text-[13.5px] font-bold text-[#111827]">
                          {svc.name}
                        </p>
                        <p className="text-[11.5px] text-[#6B7280] tabular-nums">
                          {svc.durationMinutes} mins •{' '}
                          {formatPriceFromPaise(svc.pricePaise, 'INR')}
                        </p>
                      </div>
                      {servicesDraft.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setServicesDraft((prev) =>
                              prev.filter((_, i) => i !== idx),
                            )
                          }
                          aria-label={`Remove ${svc.name}`}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 cursor-pointer"
                        >
                          <Trash2 className="h-4 w-4" aria-hidden />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Add Service Row */}
                <div className="grid gap-2 sm:grid-cols-12 pt-1">
                  <input
                    type="text"
                    placeholder="New service (e.g. Royal Shave)"
                    value={newSvcName}
                    onChange={(e) => setNewSvcName(e.target.value)}
                    className="sm:col-span-5 h-10 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                  />
                  <input
                    type="number"
                    min={5}
                    max={240}
                    placeholder="Mins"
                    value={newSvcMins}
                    onChange={(e) =>
                      setNewSvcMins(Number(e.target.value) || 20)
                    }
                    className="sm:col-span-2 h-10 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                  />
                  <input
                    type="text"
                    placeholder="₹ Price"
                    value={newSvcPriceRupees}
                    onChange={(e) => setNewSvcPriceRupees(e.target.value)}
                    className="sm:col-span-3 h-10 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px]"
                  />
                  <button
                    type="button"
                    onClick={handleAddServiceDraft}
                    className="sm:col-span-2 inline-flex h-10 items-center justify-center gap-1 rounded-xl border border-[#1E1B4B] bg-[#FFFFFF] text-[12px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5" aria-hidden /> Add
                  </button>
                </div>
              </div>

              <div className="flex justify-end pt-1">
                <Button type="submit" variant="primary" loading={savingConfig}>
                  Save Queue Configuration
                </Button>
              </div>
            </form>
          )}
        </div>
      )}
    </div>
  );
}
