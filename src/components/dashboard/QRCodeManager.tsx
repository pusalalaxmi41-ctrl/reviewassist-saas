import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  Download,
  FileText,
  Printer,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  QrCode,
  RotateCcw,
  Scissors,
  Coffee,
  Dumbbell,
  UtensilsCrossed,
  Share2,
  Upload,
  X,
} from 'lucide-react';
import type { Business } from '../../types/business';
import { copyText } from '../../utils/clipboard';
import {
  getCustomerReviewUrl,
  buildWhatsAppMessage,
  getWhatsAppShareLink,
} from '../../utils/sharing';
import {
  getBarberQueueUrl,
  isBarberOrSalonCategory,
} from '../../utils/barberQueueValidation';
import { getGymPortalUrl, isGymCategory } from '../../utils/gymValidation';
import { getCafeHubUrl, isCafeCategory } from '../../utils/cafeValidation';
import {
  generatePrintablePdfBlobFromCanvas,
  getDefaultQRDesignSettings,
  loadBusinessQRSettings,
  QR_ACCENT_PRESETS,
  QR_TEMPLATE_DEFAULTS,
  renderQrPosterToCanvas,
  saveBusinessQRSettings,
  type QRDesignSettings,
  type QRTemplateId,
} from '../../services/qr/qrGenerator';
import { Button } from '../common/Button';

interface Props {
  business: Business;
  defaultMode?: 'review' | 'barber_queue' | 'gym' | 'cafe' | 'restaurant_menu';
}

export function QRCodeManager({ business, defaultMode }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [settings, setSettings] = useState<QRDesignSettings>(() =>
    loadBusinessQRSettings(business),
  );
  const [logoError, setLogoError] = useState<string | null>(null);
  const [exportMessage, setExportMessage] = useState<string | null>(null);

  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [customPhone, setCustomPhone] = useState('');

  const supportsBarberQueue = isBarberOrSalonCategory(business.category);
  const supportsGymPortal = isGymCategory(business.category);
  const supportsCafeHub = isCafeCategory(business.category);
  const supportsRestaurantMenu =
    business.category === 'restaurant' ||
    business.category === 'hotel' ||
    business.category === 'pg';
  const resolvedDefault:
    | 'review'
    | 'barber_queue'
    | 'gym'
    | 'cafe'
    | 'restaurant_menu' =
    defaultMode ??
    (supportsCafeHub
      ? 'cafe'
      : supportsGymPortal
        ? 'gym'
        : supportsBarberQueue
          ? 'barber_queue'
          : 'review');

  const [qrMode, setQrMode] = useState<
    'review' | 'barber_queue' | 'gym' | 'cafe' | 'restaurant_menu'
  >(resolvedDefault);
  const [queueHeading, setQueueHeading] = useState('Scan to Join the Live Queue');
  const [queueInstruction, setQueueInstruction] = useState(
    'See live wait time, claim your Token QR & track your turn on your phone',
  );
  const [gymHeading, setGymHeading] = useState('Scan for Gym Pass & Daily Check-In');
  const [gymInstruction, setGymInstruction] = useState(
    'Join in 10 seconds, track your plan expiry & tap Daily Check-In at the desk',
  );
  const [cafeHeading, setCafeHeading] = useState(
    'Scan for Coffee Stamp Card & Quick Menu',
  );
  const [cafeInstruction, setCafeInstruction] = useState(
    'Collect coffee stamps, unlock your Birthday Free Coffee & skip the line',
  );
  const [menuHeading, setMenuHeading] = useState('Scan for Digital Menu & Loyalty');
  const [menuInstruction, setMenuInstruction] = useState(
    'Browse our live menu, play table games & collect Loyalty Stars',
  );

  const isQueueMode = supportsBarberQueue && qrMode === 'barber_queue';
  const isGymMode = supportsGymPortal && qrMode === 'gym';
  const isCafeMode = supportsCafeHub && qrMode === 'cafe';
  const isMenuMode = supportsRestaurantMenu && qrMode === 'restaurant_menu';
  const originHost =
    typeof window !== 'undefined'
      ? window.location.origin
      : 'http://localhost:5173';
  const menuHubUrl = `${originHost}/r/${business.slug}/menu`;

  const qrUrl = isCafeMode
    ? getCafeHubUrl(business.slug)
    : isGymMode
      ? getGymPortalUrl(business.slug)
      : isQueueMode
        ? getBarberQueueUrl(business.slug)
        : isMenuMode
          ? menuHubUrl
          : getCustomerReviewUrl(business.slug, 'qr');
  const directUrl = isCafeMode
    ? getCafeHubUrl(business.slug)
    : isGymMode
      ? getGymPortalUrl(business.slug)
      : isQueueMode
        ? getBarberQueueUrl(business.slug)
        : isMenuMode
          ? menuHubUrl
          : getCustomerReviewUrl(business.slug, 'direct');
  const whatsAppMsg = buildWhatsAppMessage(business);
  const whatsAppLink = getWhatsAppShareLink(business, customPhone);

  const effectivePosterSettings: QRDesignSettings = isCafeMode
    ? {
        ...settings,
        template: 'table_standee',
        heading: cafeHeading,
        instruction: cafeInstruction,
      }
    : isGymMode
      ? {
          ...settings,
          template: 'table_standee',
          heading: gymHeading,
          instruction: gymInstruction,
        }
      : isQueueMode
        ? {
            ...settings,
            template: 'table_standee',
            heading: queueHeading,
            instruction: queueInstruction,
          }
        : isMenuMode
          ? {
              ...settings,
              template: 'table_standee',
              heading: menuHeading,
              instruction: menuInstruction,
            }
          : settings;

  const effectiveRenderOptions = isCafeMode
    ? {
        targetUrl: qrUrl,
        customSteps: [
          'Scan QR at the coffee counter',
          'Save your Coffee Stamp Card to Home Screen',
          'Collect stamps & unlock Birthday Free Coffee',
        ] as [string, string, string],
      }
    : isGymMode
      ? {
          targetUrl: qrUrl,
          customSteps: [
            'Scan QR at the gym desk',
            'Pick plan or enter phone',
            'Tap Daily Check-In & view days left',
          ] as [string, string, string],
        }
      : isQueueMode
        ? {
            targetUrl: qrUrl,
            customSteps: [
              'Scan QR with phone camera',
              'Check live wait & select service',
              'Get your Personal Token QR & walk in on time',
            ] as [string, string, string],
          }
        : isMenuMode
          ? {
              targetUrl: qrUrl,
              customSteps: [
                'Scan QR with phone camera',
                'Explore dishes & table games',
                'Collect Loyalty Stars & rewards',
              ] as [string, string, string],
            }
          : undefined;

  // Persist per-business settings & re-render high-resolution live preview canvas
  useEffect(() => {
    saveBusinessQRSettings(business.id, settings);
    if (canvasRef.current) {
      void renderQrPosterToCanvas(
        canvasRef.current,
        business,
        isCafeMode
          ? {
              ...settings,
              template: 'table_standee',
              heading: cafeHeading,
              instruction: cafeInstruction,
            }
          : isGymMode
            ? {
                ...settings,
                template: 'table_standee',
                heading: gymHeading,
                instruction: gymInstruction,
              }
            : isQueueMode
              ? {
                  ...settings,
                  template: 'table_standee',
                  heading: queueHeading,
                  instruction: queueInstruction,
                }
              : isMenuMode
                ? {
                    ...settings,
                    template: 'table_standee',
                    heading: menuHeading,
                    instruction: menuInstruction,
                  }
                : settings,
        isCafeMode
          ? {
              targetUrl: qrUrl,
              customSteps: [
                'Scan QR at the coffee counter',
                'Save your Coffee Stamp Card to Home Screen',
                'Collect stamps & unlock Birthday Free Coffee',
              ],
            }
          : isGymMode
            ? {
                targetUrl: qrUrl,
                customSteps: [
                  'Scan QR at the gym desk',
                  'Pick plan or enter phone',
                  'Tap Daily Check-In & view days left',
                ],
              }
            : isQueueMode
              ? {
                  targetUrl: qrUrl,
                  customSteps: [
                    'Scan QR with phone camera',
                    'Check live wait & select service',
                    'Get your Personal Token QR & walk in on time',
                  ],
                }
              : isMenuMode
                ? {
                    targetUrl: qrUrl,
                    customSteps: [
                      'Scan QR with phone camera',
                      'Explore dishes & table games',
                      'Collect Loyalty Stars & rewards',
                    ],
                  }
                : undefined,
      );
    }
  }, [
    business,
    settings,
    isQueueMode,
    isGymMode,
    isCafeMode,
    isMenuMode,
    queueHeading,
    queueInstruction,
    gymHeading,
    gymInstruction,
    cafeHeading,
    cafeInstruction,
    menuHeading,
    menuInstruction,
    qrUrl,
  ]);

  function handleTemplateChange(nextTemplate: QRTemplateId) {
    const prevDefaults = QR_TEMPLATE_DEFAULTS[settings.template];
    const nextDefaults = QR_TEMPLATE_DEFAULTS[nextTemplate];

    setSettings((prev) => ({
      ...prev,
      template: nextTemplate,
      heading:
        prev.heading === prevDefaults.defaultHeading
          ? nextDefaults.defaultHeading
          : prev.heading,
      instruction:
        prev.instruction === prevDefaults.defaultInstruction
          ? nextDefaults.defaultInstruction
          : prev.instruction,
    }));
  }

  function handleLogoUpload(e: ChangeEvent<HTMLInputElement>) {
    setLogoError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      setLogoError('Please select a valid image file (PNG, JPG, SVG, or WebP).');
      return;
    }

    if (file.size > 1.5 * 1024 * 1024) {
      setLogoError('Please choose an image smaller than 1.5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        setSettings((prev) => ({ ...prev, logoDataUrl: reader.result as string }));
      }
    };
    reader.readAsDataURL(file);
  }

  function handleResetDefaults() {
    setLogoError(null);
    if (isCafeMode) {
      setCafeHeading('Scan for Coffee Stamp Card & Quick Menu');
      setCafeInstruction(
        'Collect coffee stamps, unlock your Birthday Free Coffee & skip the line',
      );
    } else if (isQueueMode) {
      setQueueHeading('Scan to Join the Live Queue');
      setQueueInstruction(
        'See live wait time, claim your token & track your turn from your phone',
      );
    }
    setSettings(getDefaultQRDesignSettings(business));
  }

  async function handleDownloadPng() {
    if (!canvasRef.current) return;
    await renderQrPosterToCanvas(
      canvasRef.current,
      business,
      effectivePosterSettings,
      effectiveRenderOptions,
    );
    const pngUrl = canvasRef.current.toDataURL('image/png');
    const filename = isCafeMode
      ? `${business.slug}-cafe-stamp-qr.png`
      : isGymMode
        ? `${business.slug}-gym-pass-qr.png`
        : isQueueMode
          ? `${business.slug}-live-queue-qr.png`
          : `${business.slug}-${settings.template}-qr.png`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setExportMessage(`Downloaded high-resolution PNG (${filename}).`);
  }

  async function handleDownloadPdf() {
    if (!canvasRef.current) return;
    await renderQrPosterToCanvas(
      canvasRef.current,
      business,
      effectivePosterSettings,
      effectiveRenderOptions,
    );
    const pdfBlob = generatePrintablePdfBlobFromCanvas(canvasRef.current);
    const blobUrl = URL.createObjectURL(pdfBlob);
    const filename = isCafeMode
      ? `${business.slug}-cafe-stamp-qr.pdf`
      : isGymMode
        ? `${business.slug}-gym-pass-qr.pdf`
        : isQueueMode
          ? `${business.slug}-live-queue-qr.pdf`
          : `${business.slug}-${settings.template}-qr.pdf`;
    const link = document.createElement('a');
    link.download = filename;
    link.href = blobUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);
    setExportMessage(`Downloaded printable A5 PDF (${filename}).`);
  }

  async function handleCopyLink() {
    const ok = await copyText(directUrl);
    if (ok) {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  }

  async function handleCopyWhatsAppMessage() {
    const ok = await copyText(whatsAppMsg);
    if (ok) {
      setCopiedMsg(true);
      setTimeout(() => setCopiedMsg(false), 2000);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="space-y-8">
      {/* Industry Standee Mode Switcher: Restaurant Menu / Cafe Stamp Card / Barber Live Queue / Gym Desk Pass vs Google Review QR */}
      {(supportsRestaurantMenu ||
        supportsCafeHub ||
        supportsBarberQueue ||
        supportsGymPortal) && (
        <div className="inline-flex flex-wrap items-center gap-1.5 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-2 shadow-2xs">
          {supportsCafeHub && (
            <button
              type="button"
              onClick={() => setQrMode('cafe')}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
                isCafeMode
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29]'
              }`}
            >
              <Coffee
                className={`h-4 w-4 ${isCafeMode ? 'text-[#D2DB76]' : ''}`}
                aria-hidden
              />
              <span>Coffee Stamp Card &amp; Quick Menu QR</span>
            </button>
          )}
          {supportsRestaurantMenu && (
            <button
              type="button"
              onClick={() => setQrMode('restaurant_menu')}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
                isMenuMode
                  ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29]'
              }`}
            >
              <UtensilsCrossed
                className={`h-4 w-4 ${isMenuMode ? 'text-[#D2DB76]' : ''}`}
                aria-hidden
              />
              <span>Digital Menu &amp; Loyalty Standee</span>
            </button>
          )}
          {supportsBarberQueue && (
            <button
              type="button"
              onClick={() => setQrMode('barber_queue')}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
                isQueueMode
                  ? 'bg-[#111318] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29]'
              }`}
            >
              <Scissors
                className={`h-4 w-4 ${isQueueMode ? 'text-[#F3E3B8]' : ''}`}
                aria-hidden
              />
              <span>Live Queue &amp; Wait-Time QR Standee</span>
            </button>
          )}
          {supportsGymPortal && (
            <button
              type="button"
              onClick={() => setQrMode('gym')}
              className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
                isGymMode
                  ? 'bg-[#0F172A] text-[#FFFFFF] shadow-2xs'
                  : 'text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29]'
              }`}
            >
              <Dumbbell
                className={`h-4 w-4 ${isGymMode ? 'text-[#A3E635]' : ''}`}
                aria-hidden
              />
              <span>Front-Desk Gym Pass &amp; Check-In QR</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setQrMode('review')}
            className={`inline-flex h-10 items-center gap-2 rounded-xl px-4 text-[13px] font-bold transition-all cursor-pointer ${
              !isCafeMode && !isQueueMode && !isGymMode && !isMenuMode
                ? 'bg-[#1E1B4B] text-[#FFFFFF] shadow-2xs'
                : 'text-[#626B65] hover:bg-[#F7F7F2] hover:text-[#252B29]'
            }`}
          >
            <QrCode className="h-4 w-4" aria-hidden />
            <span>Google Review QR</span>
          </button>
        </div>
      )}

      {/* Action / Share Bar */}
      <div className="flex flex-col gap-4 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-5 sm:flex-row sm:items-center sm:justify-between shadow-2xs">
        <div className="space-y-1">
          <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
            {isCafeMode
              ? 'Counter Coffee Stamp Card & Quick Menu URL (Encoded in QR)'
              : isGymMode
                ? 'Front-Desk Gym Membership & Check-In URL (Encoded in QR)'
                : isQueueMode
                  ? 'Live Queue & Wait-Time Standee URL (Encoded in QR)'
                  : isMenuMode
                    ? 'Digital Menu & Loyalty Hub URL (Encoded in QR)'
                    : 'Business-Specific Customer Review URL (Encoded in QR)'}
          </p>
          <p className="break-all font-mono text-[14px] font-medium text-[#244B40]">{qrUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="secondary" onClick={() => void handleCopyLink()}>
            {copiedLink ? (
              <Check className="h-4 w-4 text-[#244B40]" aria-hidden />
            ) : (
              <Copy className="h-4 w-4" aria-hidden />
            )}
            {copiedLink ? 'Copied' : 'Copy link'}
          </Button>
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-4 py-2.5 text-[14px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden /> Test link
          </a>
        </div>
      </div>

      {/* Two-Column Desktop Layout: LEFT = QR Settings & Downloads, RIGHT = Live QR Preview */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* LEFT COLUMN: QR Design Settings, Branding, and Download Options */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-5">
            <div className="flex items-center justify-between border-b border-[#DDE4DC] pb-4">
              <div>
                <h3 className="text-[18px] font-semibold tracking-tight text-[#252B29] flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-[#244B40]" aria-hidden /> QR Design &amp; Branding Settings
                </h3>
                <p className="text-[13px] text-[#626B65] mt-0.5">
                  Customize your printable QR card for <strong className="text-[#252B29]">{business.name}</strong>.
                </p>
              </div>
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3 py-1.5 text-[13px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
                title="Reset to template defaults"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden /> Reset
              </button>
            </div>

            {/* 1. Template Selection */}
            <div className="space-y-2">
              <label className="block text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
                1. Select Template
              </label>
              <div className="grid gap-2.5">
                {(
                  ['minimal_google', 'business_branded', 'table_standee'] as QRTemplateId[]
                ).map((tplId) => {
                  const tpl = QR_TEMPLATE_DEFAULTS[tplId];
                  const isSelected = settings.template === tplId;
                  return (
                    <button
                      key={tplId}
                      type="button"
                      onClick={() => handleTemplateChange(tplId)}
                      aria-pressed={isSelected}
                      className={`w-full rounded-xl border p-3.5 text-left transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                        isSelected
                          ? 'border-[#244B40] bg-[#EEF3EC]/70 ring-1 ring-[#244B40]'
                          : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40] hover:bg-[#F7F7F2]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[15px] font-semibold text-[#252B29]">
                          {tpl.name}
                        </span>
                        {isSelected && (
                          <span className="rounded-full bg-[#244B40] px-2.5 py-0.5 text-[11px] font-semibold text-[#FFFFFF]">
                            Selected
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[13px] text-[#626B65]">
                        {tpl.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Text & Branding Customization */}
            <div className="space-y-4 border-t border-[#DDE4DC] pt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
                2. Customize Text &amp; Branding
              </p>

              <div className="space-y-1.5">
                <label
                  htmlFor="qrBusinessNameInput"
                  className="block text-[13px] font-medium text-[#252B29]"
                >
                  Displayed Business Name
                </label>
                <input
                  id="qrBusinessNameInput"
                  type="text"
                  maxLength={60}
                  value={settings.businessName}
                  onChange={(e) =>
                    setSettings((prev) => ({
                      ...prev,
                      businessName: e.target.value,
                    }))
                  }
                  className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="qrHeadingInput"
                  className="block text-[13px] font-medium text-[#252B29]"
                >
                  Call-to-Action Heading
                </label>
                <input
                  id="qrHeadingInput"
                  type="text"
                  maxLength={70}
                  value={
                    isCafeMode
                      ? cafeHeading
                      : isGymMode
                        ? gymHeading
                        : isQueueMode
                          ? queueHeading
                          : isMenuMode
                            ? menuHeading
                            : settings.heading
                  }
                  onChange={(e) => {
                    if (isCafeMode) {
                      setCafeHeading(e.target.value);
                    } else if (isGymMode) {
                      setGymHeading(e.target.value);
                    } else if (isQueueMode) {
                      setQueueHeading(e.target.value);
                    } else if (isMenuMode) {
                      setMenuHeading(e.target.value);
                    } else {
                      setSettings((prev) => ({
                        ...prev,
                        heading: e.target.value,
                      }));
                    }
                  }}
                  className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
                />
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="qrInstructionInput"
                  className="block text-[13px] font-medium text-[#252B29]"
                >
                  Supporting Instruction
                </label>
                <input
                  id="qrInstructionInput"
                  type="text"
                  maxLength={90}
                  value={
                    isCafeMode
                      ? cafeInstruction
                      : isGymMode
                        ? gymInstruction
                        : isQueueMode
                          ? queueInstruction
                          : isMenuMode
                            ? menuInstruction
                            : settings.instruction
                  }
                  onChange={(e) => {
                    if (isCafeMode) {
                      setCafeInstruction(e.target.value);
                    } else if (isGymMode) {
                      setGymInstruction(e.target.value);
                    } else if (isQueueMode) {
                      setQueueInstruction(e.target.value);
                    } else if (isMenuMode) {
                      setMenuInstruction(e.target.value);
                    } else {
                      setSettings((prev) => ({
                        ...prev,
                        instruction: e.target.value,
                      }));
                    }
                  }}
                  className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
                />
              </div>

              {/* High-Contrast Accent Color Presets */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#252B29]">
                  Accent Colour (High-Contrast Print Presets)
                </label>
                <div className="flex flex-wrap gap-2">
                  {QR_ACCENT_PRESETS.map((preset) => {
                    const active =
                      settings.accentColor.toLowerCase() ===
                      preset.hex.toLowerCase();
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            accentColor: preset.hex,
                          }))
                        }
                        className={`inline-flex items-center gap-2 rounded-xl border px-3 py-1.5 text-[13px] font-medium transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] ${
                          active
                            ? 'border-[#244B40] bg-[#244B40] text-[#FFFFFF] shadow-2xs'
                            : 'border-[#87928A] bg-[#FFFFFF] text-[#252B29] hover:bg-[#F7F7F2]'
                        }`}
                      >
                        <span
                          className="h-3.5 w-3.5 rounded-full border border-white/40"
                          style={{ backgroundColor: preset.hex }}
                        />
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Optional Business Logo Upload */}
              <div className="space-y-1.5">
                <label className="block text-[13px] font-medium text-[#252B29]">
                  Business Logo (Optional — placed in header, never covers QR modules)
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <label className="inline-flex min-h-10 cursor-pointer items-center gap-1.5 rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[13px] font-medium text-[#252B29] hover:border-[#244B40] hover:bg-[#F7F7F2]">
                    <Upload className="h-3.5 w-3.5 text-[#244B40]" aria-hidden />
                    <span>{settings.logoDataUrl ? 'Change Logo' : 'Upload Logo'}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml"
                      onChange={handleLogoUpload}
                      className="sr-only"
                    />
                  </label>
                  {settings.logoDataUrl && (
                    <button
                      type="button"
                      onClick={() =>
                        setSettings((prev) => ({ ...prev, logoDataUrl: null }))
                      }
                      className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-red-300 bg-red-50 px-3 py-2 text-[13px] font-medium text-red-800 hover:bg-red-100 cursor-pointer"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden /> Remove Logo
                    </button>
                  )}
                </div>
                {logoError && (
                  <p className="text-[13px] text-red-700" role="alert">{logoError}</p>
                )}
              </div>
            </div>

            {/* 3. Export & Download Options */}
            <div className="space-y-3 border-t border-[#DDE4DC] pt-4">
              <p className="text-[12px] font-semibold uppercase tracking-wider text-[#626B65]">
                3. Download &amp; Print Options
              </p>
              <div className="grid gap-2.5 sm:grid-cols-3">
                <Button
                  type="button"
                  variant="primary"
                  onClick={() => void handleDownloadPng()}
                >
                  <Download className="h-4 w-4" aria-hidden /> Download PNG
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => void handleDownloadPdf()}
                >
                  <FileText className="h-4 w-4" aria-hidden /> Download PDF
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={handlePrint}
                >
                  <Printer className="h-4 w-4" aria-hidden /> Print Standee
                </Button>
              </div>
              {exportMessage && (
                <p role="status" className="text-[13px] font-medium text-[#244B40]">
                  {exportMessage}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live High-Resolution QR Poster Preview */}
        <div className="lg:col-span-6 space-y-6">
          <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-4">
            <div className="flex items-center justify-between border-b border-[#DDE4DC] pb-3">
              <div>
                <h3 className="text-[18px] font-semibold tracking-tight text-[#252B29]">
                  Live QR Poster Preview
                </h3>
                <p className="text-[13px] text-[#626B65]">
                  Matches PNG (`1200×1700 px`) &amp; A5 PDF output · Quiet zone &amp; contrast verified
                </p>
              </div>
              <span className="rounded-full bg-[#EEF3EC] border border-[#A8BFA5] px-2.5 py-0.5 text-[12px] font-medium text-[#244B40]">
                Scannable QR
              </span>
            </div>

            <div className="flex justify-center rounded-xl border border-[#DDE4DC] bg-[#F7F7F2] p-4 sm:p-6">
              <div
                id="printable-standee"
                className="w-full max-w-[380px] overflow-hidden rounded-xl shadow-md bg-[#FFFFFF]"
              >
                <canvas
                  ref={canvasRef}
                  aria-label={`QR Code Poster Preview for ${business.name}`}
                  className="block h-auto w-full"
                />
              </div>
            </div>
          </div>

          {/* WhatsApp Sharing Suite (Preserved from existing dashboard) */}
          <div className="rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] p-6 shadow-2xs space-y-5">
            <div>
              <h3 className="text-[18px] font-semibold tracking-tight text-[#252B29] flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-[#244B40]" aria-hidden /> WhatsApp Sharing
              </h3>
              <p className="text-[13px] text-[#626B65] mt-1">
                Send a pre-formatted feedback request message directly to customers via WhatsApp.
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="block text-[13px] font-medium text-[#252B29]">
                Pre-formatted Message Preview
              </label>
              <div className="rounded-xl bg-[#EEF3EC]/60 border border-[#A8BFA5] p-3.5 text-[13px] text-[#252B29] font-sans leading-relaxed whitespace-pre-wrap">
                {whatsAppMsg}
              </div>
            </div>

            <div className="space-y-1.5">
              <label
                htmlFor="customerPhone"
                className="block text-[13px] font-medium text-[#252B29]"
              >
                Customer Phone Number (Optional)
              </label>
              <input
                id="customerPhone"
                type="tel"
                placeholder="+91 98765 43210"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="block min-h-11 w-full rounded-xl border border-[#87928A] bg-[#FFFFFF] px-3.5 py-2 text-[14px] text-[#252B29] focus:border-[#244B40] focus:outline-none focus:ring-2 focus:ring-[#244B40]/20"
              />
            </div>

            <div className="space-y-2 pt-1">
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[#244B40] px-4 py-2.5 text-[14px] font-medium text-[#FFFFFF] hover:bg-[#1C3B32] transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2"
              >
                <Share2 className="h-4 w-4" aria-hidden /> Share via WhatsApp
              </a>

              <Button
                variant="secondary"
                className="w-full"
                onClick={() => void handleCopyWhatsAppMessage()}
              >
                {copiedMsg ? (
                  <Check className="h-4 w-4 text-[#244B40]" aria-hidden />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden />
                )}
                {copiedMsg ? 'Message Copied' : 'Copy Message Text'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
