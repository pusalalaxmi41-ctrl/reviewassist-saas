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
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react';
import type { Business } from '../../types/business';
import type {
  BarberQueueDelayIncrement,
  BarberQueueService,
  BarberQueueTicketStatus,
  PublicBarberQueueStatusPayload,
} from '../../types/barberQueue';
import { businessRepository } from '../../services/storage';
import {
  getBarberQueueUrl,
  getBarberStaffUrl,
} from '../../utils/barberQueueValidation';
import { formatPriceFromPaise } from '../../utils/restaurantValidation';
import {
  generatePrintablePdfBlobFromCanvas,
  loadBusinessQRSettings,
  renderQrPosterToCanvas,
} from '../../services/qr/qrGenerator';
import { copyText } from '../../utils/clipboard';
import { Button } from '../common/Button';

interface Props {
  business: Business;
  isBusinessLive: boolean;
  mode: 'owner' | 'barber_staff';
  staffPinHash?: string | null;
  staffLabel?: string;
}

export function BarberQueueManagerView({
  business,
  isBusinessLive,
  mode,
  staffPinHash = null,
  staffLabel = 'Owner',
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

  // Quick Walk-In Entry (for guests without a phone)
  const [showWalkInForm, setShowWalkInForm] = useState(false);
  const [walkInName, setWalkInName] = useState('');
  const [walkInPhone, setWalkInPhone] = useState('');
  const [walkInService, setWalkInService] = useState('Classic Haircut');
  const [addingWalkIn, setAddingWalkIn] = useState(false);

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
    },
    [business, mode],
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

  async function handleAddWalkIn(e: React.FormEvent) {
    e.preventDefault();
    setAddingWalkIn(true);
    setErrorMessage(null);
    try {
      const res = await businessRepository.joinBarberQueue({
        businessSlug: business.slug,
        guestName: walkInName.trim(),
        phone: walkInPhone.trim() || null,
        serviceName: walkInService,
      });
      setWalkInName('');
      setWalkInPhone('');
      setShowWalkInForm(false);
      await refreshQueue(false);
      notifyStatus(
        `Added ${res.ticket.guestName} as Token #${res.ticket.tokenNumber} (~${res.estimatedWaitMinutes} mins wait).`,
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

      {/* 1-TAP BROADCAST TIMER CONTROLS (Fast 1-Handed Taps Between Cuts) */}
      <div className="bistro-card p-5 space-y-3.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#6B7280] flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 text-[#1E1B4B]" aria-hidden />
              1-Tap Broadcast Delay to All Waiting Phones
            </p>
            <p className="text-[12.5px] text-[#6B7280] mt-0.5">
              Running behind on a tricky fade? Tap once to update every waiting customer&apos;s live countdown.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-[#D2DB76]/55 px-3 py-1 text-[12px] font-extrabold text-[#1E1B4B] tabular-nums">
              {completedTodayCount} Cuts Done Today
            </span>
            <button
              type="button"
              onClick={() => void refreshQueue(false)}
              aria-label="Sync queue"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-[#1E1B4B]/15 bg-[#F8F9FA] text-[#1E1B4B] hover:bg-[#1E1B4B]/10 cursor-pointer"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3">
          {([5, 10, 15] as const).map((mins) => (
            <button
              key={mins}
              type="button"
              disabled={extendingMins !== null}
              onClick={() => void handleBroadcastDelay(mins)}
              className="flex min-h-14 flex-col items-center justify-center rounded-2xl border-2 border-[#1E1B4B]/15 bg-[#1E1B4B] px-3 py-2.5 text-[#FFFFFF] shadow-sm hover:bg-[#2E2A6E] active:scale-[0.97] transition-all disabled:opacity-50 cursor-pointer"
            >
              <span className="text-[18px] font-black text-[#D2DB76] tabular-nums">
                +{mins} Mins
              </span>
              <span className="text-[10.5px] font-semibold text-white/80">
                {extendingMins === mins ? 'Sending…' : 'Broadcast'}
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

      {/* ACTIVE CHAIR & WAITING QUEUE (2-Column on Desktop, Stacked on Mobile) */}
      <div
        className={`grid gap-5 ${mode === 'owner' ? 'lg:grid-cols-12' : ''} items-start`}
      >
        {/* CURRENTLY IN CHAIR CARD */}
        <section
          aria-label="Currently In Chair"
          className={`${mode === 'owner' ? 'lg:col-span-5' : ''} rounded-3xl border-2 border-[#1E1B4B] bg-[#1E1B4B] p-6 text-[#FFFFFF] shadow-md space-y-4`}
        >
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-[#D2DB76] px-3 py-1 text-[11px] font-black uppercase tracking-wider text-[#1E1B4B]">
              <Scissors className="h-3.5 w-3.5" aria-hidden />
              Currently In Chair
            </span>
            {nowServing && (
              <span className="text-[12px] font-bold text-[#D2DB76] tabular-nums">
                ~{nowServing.remainingMinutes ?? nowServing.durationMinutes}m left
              </span>
            )}
          </div>

          {nowServing ? (
            <div className="space-y-4">
              <div>
                <p className="text-[44px] leading-none font-black text-[#D2DB76] tabular-nums">
                  Token #{nowServing.tokenNumber}
                </p>
                <p className="mt-2 text-[20px] font-extrabold text-[#FFFFFF]">
                  {nowServing.guestName}
                </p>
                <p className="text-[13px] font-medium text-white/75">
                  {nowServing.serviceName} • {nowServing.durationMinutes} mins
                  {nowServing.assignedBarberLabel
                    ? ` • ${nowServing.assignedBarberLabel}`
                    : ''}
                </p>
              </div>

              <button
                type="button"
                disabled={busyTicketId === nowServing.id}
                onClick={() =>
                  void handleAdvanceTicket(nowServing.id, 'completed')
                }
                className="flex min-h-14 w-full items-center justify-center gap-2 rounded-2xl bg-[#059669] px-5 py-3.5 text-[15px] font-extrabold text-[#FFFFFF] shadow-lg hover:bg-emerald-600 active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
              >
                <CheckCircle2 className="h-5 w-5" aria-hidden />
                {busyTicketId === nowServing.id
                  ? 'Completing…'
                  : config?.awardStarOnCompletion && nowServing.customerId
                    ? 'Complete Cut (+1 Star) ✓'
                    : 'Complete Cut ✓'}
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-white/15 bg-white/5 p-6 text-center space-y-2">
              <Scissors
                className="mx-auto h-8 w-8 text-[#D2DB76]/80"
                aria-hidden
              />
              <p className="text-[16px] font-extrabold text-[#FFFFFF]">
                Barber Chair is Ready
              </p>
              <p className="text-[12.5px] text-white/75">
                Tap &ldquo;Call to Chair →&rdquo; on the next waiting token to begin their session.
              </p>
            </div>
          )}
        </section>

        {/* WAITING QUEUE LIST */}
        <section
          aria-label="Waiting Queue"
          className={`${mode === 'owner' ? 'lg:col-span-7' : ''} bistro-card p-5 sm:p-6 space-y-4`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <h2 className="text-[18px] font-extrabold text-[#111827] flex items-center gap-2">
                <Users className="h-5 w-5 text-[#1E1B4B]" aria-hidden />
                Waiting Line
              </h2>
              <span className="inline-flex h-6 min-w-6 items-center justify-center rounded-full bg-[#1E1B4B] px-2 text-[12px] font-bold text-[#FFFFFF] tabular-nums">
                {waitingTickets.length}
              </span>
            </div>

            <button
              type="button"
              onClick={() => setShowWalkInForm((v) => !v)}
              className="inline-flex h-9 items-center gap-1.5 rounded-xl bg-[#1E1B4B]/[0.07] px-3.5 text-[12.5px] font-extrabold text-[#1E1B4B] hover:bg-[#1E1B4B] hover:text-[#FFFFFF] transition-colors cursor-pointer"
            >
              <UserPlus className="h-3.5 w-3.5" aria-hidden />
              + Add Walk-In
            </button>
          </div>

          {/* Quick Walk-In Entry Form */}
          {showWalkInForm && (
            <form
              onSubmit={(e) => void handleAddWalkIn(e)}
              className="rounded-2xl border border-[#1E1B4B]/15 bg-[#F8F9FA] p-4 space-y-3 animate-fadeSlideUp"
            >
              <div className="grid gap-3 sm:grid-cols-3">
                <input
                  type="text"
                  required
                  maxLength={80}
                  placeholder="Guest Name (e.g. Suresh)"
                  value={walkInName}
                  onChange={(e) => setWalkInName(e.target.value)}
                  className="h-10 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
                <input
                  type="tel"
                  maxLength={40}
                  placeholder="Phone (Optional, for ★)"
                  value={walkInPhone}
                  onChange={(e) => setWalkInPhone(e.target.value)}
                  className="h-10 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                />
                <select
                  value={walkInService}
                  onChange={(e) => setWalkInService(e.target.value)}
                  className="h-10 rounded-xl border border-[#1E1B4B]/20 bg-[#FFFFFF] px-3 text-[13px] font-semibold text-[#111827] focus:border-[#1E1B4B] focus:outline-none"
                >
                  {(config?.services ?? []).map((svc) => (
                    <option key={svc.id} value={svc.name}>
                      {svc.name} ({svc.durationMinutes}m)
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setShowWalkInForm(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={addingWalkIn}>
                  Issue Queue Token
                </Button>
              </div>
            </form>
          )}

          {waitingTickets.length === 0 ? (
            <div className="rounded-2xl border border-[#1E1B4B]/10 bg-[#F8F9FA] p-8 text-center space-y-1.5">
              <Sparkles
                className="mx-auto h-7 w-7 text-[#1E1B4B]/50"
                aria-hidden
              />
              <p className="text-[15px] font-bold text-[#111827]">
                No one waiting in line right now
              </p>
              <p className="text-[12.5px] text-[#6B7280]">
                Walk-ins who scan your Live Queue QR standee appear here in exact token order.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {waitingTickets.map((ticket, idx) => {
                const isBusy = busyTicketId === ticket.id;
                const isUpNext = idx === 0;
                return (
                  <div
                    key={ticket.id}
                    className={`rounded-2xl border p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                      isUpNext
                        ? 'border-[#1E1B4B]/35 bg-[#D2DB76]/25'
                        : 'border-[#1E1B4B]/12 bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="flex items-center gap-3.5 min-w-0">
                      <span
                        className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl font-black text-[18px] tabular-nums ${
                          isUpNext
                            ? 'bg-[#1E1B4B] text-[#D2DB76]'
                            : 'bg-[#F8F9FA] border border-[#1E1B4B]/15 text-[#1E1B4B]'
                        }`}
                      >
                        #{ticket.tokenNumber}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-[15px] font-extrabold text-[#111827] truncate">
                            {ticket.guestName}
                          </p>
                          {isUpNext && (
                            <span className="rounded-full bg-[#1E1B4B] px-2 py-0.5 text-[10px] font-extrabold uppercase text-[#D2DB76]">
                              Up Next
                            </span>
                          )}
                          {ticket.extraDelayMinutes > 0 && (
                            <span className="rounded-full bg-amber-100 border border-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-[#D97706]">
                              +{ticket.extraDelayMinutes}m delay
                            </span>
                          )}
                        </div>
                        <p className="text-[12.5px] font-semibold text-[#6B7280] tabular-nums">
                          {ticket.serviceName} ({ticket.durationMinutes}m) • Est. wait:{' '}
                          <strong className="text-[#111827]">
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
                        className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#1E1B4B] px-4 text-[12.5px] font-extrabold text-[#FFFFFF] hover:bg-[#2E2A6E] active:scale-[0.98] transition-all disabled:opacity-50 cursor-pointer"
                      >
                        <Play className="h-3.5 w-3.5 text-[#D2DB76]" aria-hidden />
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
      </div>

      {/* Owner Collapsible Services & Queue Rules Settings */}
      {mode === 'owner' && (
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
