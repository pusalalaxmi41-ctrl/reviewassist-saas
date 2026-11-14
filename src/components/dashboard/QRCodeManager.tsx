import { useEffect, useRef, useState } from 'react';
import QRCode from 'qrcode';
import {
  Download,
  Printer,
  Copy,
  Check,
  ExternalLink,
  MessageCircle,
  QrCode,
  Sparkles,
  Share2,
} from 'lucide-react';
import type { Business } from '../../types/business';
import { copyText } from '../../utils/clipboard';
import { getCustomerReviewUrl, buildWhatsAppMessage, getWhatsAppShareLink } from '../../utils/sharing';
import { categoryLabels } from '../../services/business/mockBusinesses';
import { Button } from '../common/Button';

interface Props {
  business: Business;
}

export function QRCodeManager({ business }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [customPhone, setCustomPhone] = useState('');

  const qrUrl = getCustomerReviewUrl(business.slug, 'qr');
  const directUrl = getCustomerReviewUrl(business.slug, 'direct');
  const whatsAppMsg = buildWhatsAppMessage(business);
  const whatsAppLink = getWhatsAppShareLink(business, customPhone);

  useEffect(() => {
    if (canvasRef.current) {
      void QRCode.toCanvas(canvasRef.current, qrUrl, {
        width: 320,
        margin: 2,
        color: {
          dark: '#0f172a',
          light: '#ffffff',
        },
      });
    }
  }, [qrUrl]);

  function handleDownloadPng() {
    if (!canvasRef.current) return;
    const pngUrl = canvasRef.current.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `${business.slug}-review-qr.png`;
    link.href = pngUrl;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
      {/* Action / Share Bar */}
      <div className="flex flex-col gap-4 rounded-xl border border-slate-200 bg-white p-5 sm:flex-row sm:items-center sm:justify-between shadow-sm">
        <div className="space-y-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer Direct Link</p>
          <p className="break-all font-mono text-sm text-indigo-700">{directUrl}</p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <Button variant="secondary" onClick={handleCopyLink}>
            {copiedLink ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
            {copiedLink ? 'Copied' : 'Copy link'}
          </Button>
          <a
            href={directUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
          >
            <ExternalLink className="h-4 w-4" /> Test link
          </a>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-12">
        {/* QR Code & Standee Preview */}
        <div className="lg:col-span-7 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <div>
                <h3 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                  <QrCode className="h-5 w-5 text-indigo-600" /> Unique QR Code & Standee
                </h3>
                <p className="text-xs text-slate-500">
                  Embeds URL: <span className="font-mono text-slate-700">{qrUrl}</span>
                </p>
              </div>
              <div className="flex gap-2">
                <Button variant="secondary" onClick={handleDownloadPng} title="Download PNG">
                  <Download className="h-4 w-4" /> Download PNG
                </Button>
                <Button variant="primary" onClick={handlePrint} title="Print Table Standee">
                  <Printer className="h-4 w-4" /> Print Standee
                </Button>
              </div>
            </div>

            {/* Standee Preview Card (print target) */}
            <div className="flex justify-center p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div
                id="printable-standee"
                className="w-full max-w-sm rounded-2xl border-2 border-slate-900 bg-white p-6 shadow-md text-center flex flex-col items-center print:border-none print:shadow-none print:max-w-none"
              >
                <div className="flex items-center gap-1.5 rounded-full bg-slate-100 px-3 py-0.5 text-[11px] font-semibold text-slate-700 uppercase tracking-wide">
                  {categoryLabels[business.category]} · {business.city}
                </div>

                <h4 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
                  {business.name}
                </h4>
                <p className="mt-1 text-xs text-slate-500">We appreciate your feedback!</p>

                {/* Canvas QR Container */}
                <div className="my-4 rounded-xl border border-slate-200 bg-white p-3 shadow-inner">
                  <canvas ref={canvasRef} className="h-48 w-48 mx-auto" />
                  <p className="mt-1.5 text-[11px] font-semibold tracking-wider text-slate-700 uppercase">
                    Scan with camera
                  </p>
                </div>

                {/* Steps Guide */}
                <div className="w-full space-y-1.5 rounded-xl bg-slate-50 p-3 text-left border border-slate-100">
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">1</span>
                    Speak or write your experience
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">2</span>
                    <span className="flex items-center gap-1">AI assists with clean phrasing <Sparkles className="h-3 w-3 text-amber-500" /></span>
                  </div>
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-800">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-bold text-white">3</span>
                    Copy & post directly to Google
                  </div>
                </div>

                <p className="mt-3 text-[10px] font-medium text-slate-400">
                  Powered by ReviewAssist · Instant & Private
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* WhatsApp Sharing Suite */}
        <div className="lg:col-span-5 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm space-y-5">
            <div>
              <h3 className="text-lg font-bold tracking-tight text-slate-900 flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-emerald-600" /> WhatsApp Sharing
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                Send a pre-formatted feedback request message directly to customers via WhatsApp.
              </p>
            </div>

            {/* Message Preview */}
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-700">Pre-formatted Message Preview</label>
              <div className="rounded-lg bg-emerald-50/60 border border-emerald-200 p-3.5 text-xs text-slate-800 font-sans leading-relaxed whitespace-pre-wrap">
                {whatsAppMsg}
              </div>
            </div>

            {/* Custom Customer Phone Input */}
            <div className="space-y-1.5">
              <label htmlFor="customerPhone" className="block text-xs font-medium text-slate-700">
                Customer Phone Number (Optional)
              </label>
              <input
                id="customerPhone"
                type="tel"
                placeholder="+91 98765 43210"
                value={customPhone}
                onChange={(e) => setCustomPhone(e.target.value)}
                className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
              />
              <p className="text-[11px] text-slate-500">
                Leave empty to open WhatsApp and pick any contact or group.
              </p>
            </div>

            <div className="space-y-2 pt-2">
              <a
                href={whatsAppLink}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-emerald-600 px-4 py-2.5 text-sm font-medium text-white hover:bg-emerald-700 transition-colors"
              >
                <Share2 className="h-4 w-4" /> Share via WhatsApp
              </a>

              <Button variant="secondary" className="w-full" onClick={handleCopyWhatsAppMessage}>
                {copiedMsg ? <Check className="h-4 w-4 text-emerald-600" /> : <Copy className="h-4 w-4" />}
                {copiedMsg ? 'Message Copied' : 'Copy Message Text'}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
