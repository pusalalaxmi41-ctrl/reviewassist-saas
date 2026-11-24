import { useRef, useState, type ChangeEvent } from 'react';
import {
  Camera,
  Check,
  Copy,
  RefreshCw,
  Ruler,
  Scissors,
  Sparkles,
  Upload,
  UserCheck,
  X,
} from 'lucide-react';
import {
  callVisionFaceAnalyzer,
  classifyFaceGeometry,
  compressFaceImageForAnalysis,
  type FaceAnalysisResult,
  type FaceGender,
  type FaceGeometryMetrics,
} from '../../services/barber/faceShaper';
import { copyText } from '../../utils/clipboard';

interface Props {
  variant?: 'customer' | 'studio';
  /** Optional callback to copy the recommended cut directly into a customer queue/booking flow */
  onApplyRecommendation?: (summaryNote: string, result: FaceAnalysisResult) => void;
}

const DEFAULT_METRICS: FaceGeometryMetrics = {
  gender: 'male',
  foreheadWidth: 74,
  cheekboneWidth: 78,
  jawWidth: 68,
  faceLength: 88,
  jawContour: 'rounded',
};

export function FaceShapeAnalyzer({
  variant = 'customer',
  onApplyRecommendation,
}: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [mode, setMode] = useState<'photo' | 'caliper'>('photo');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<FaceGeometryMetrics>(DEFAULT_METRICS);
  const [analyzing, setAnalyzing] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<FaceAnalysisResult | null>(null);
  const [copiedPrompt, setCopiedPrompt] = useState(false);
  const [caliperAdjusted, setCaliperAdjusted] = useState(false);

  function stopCamera() {
    if (streamRef.current) {
      for (const track of streamRef.current.getTracks()) {
        track.stop();
      }
      streamRef.current = null;
    }
    setCameraOpen(false);
  }

  async function processBlobAndAnalyze(blob: Blob) {
    setError(null);
    setAnalyzing(true);
    setCaliperAdjusted(false);
    try {
      const processed = await compressFaceImageForAnalysis(blob);
      setPreviewUrl(processed.previewDataUrl);

      const mergedMetrics: FaceGeometryMetrics = {
        ...metrics,
        ...processed.autoMetrics,
      };
      setMetrics(mergedMetrics);

      const visionResult = await callVisionFaceAnalyzer(
        processed.base64,
        processed.mimeType,
      );

      if (visionResult) {
        setResult(visionResult);
      } else {
        // Clean local proportion engine (zero failed requests when Vision key isn't active)
        setResult(classifyFaceGeometry(mergedMetrics));
      }
    } catch (err) {
      setError((err as Error).message || 'Unable to process image.');
    } finally {
      setAnalyzing(false);
    }
  }

  function handleFileChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('Please choose a valid photo (JPG, PNG, or WebP).');
      return;
    }
    void processBlobAndAnalyze(file);
  }

  async function handleOpenCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError('Camera is unavailable on this browser. Please upload a selfie instead.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      window.setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play();
        }
      }, 60);
    } catch {
      setError('Camera permission was declined. You can upload a gallery selfie below.');
    }
  }

  function handleCaptureSelfie() {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const w = video.videoWidth || 640;
    const h = video.videoHeight || 640;
    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, w, h);
    stopCamera();
    canvas.toBlob(
      (blob) => {
        if (blob) {
          void processBlobAndAnalyze(blob);
        }
      },
      'image/jpeg',
      0.88,
    );
  }

  function updateMetric<K extends keyof FaceGeometryMetrics>(
    key: K,
    value: FaceGeometryMetrics[K],
  ) {
    const next = { ...metrics, [key]: value };
    setMetrics(next);
    setCaliperAdjusted(true);
    setResult(classifyFaceGeometry(next));
  }

  async function handleCopyBarberScript() {
    if (!result) return;
    const ok = await copyText(`${result.faceShape} Face: ${result.barberPrompt}`);
    if (ok) {
      setCopiedPrompt(true);
      window.setTimeout(() => setCopiedPrompt(false), 2000);
    }
  }

  const isStudio = variant === 'studio';

  return (
    <section
      aria-label="Face Shape & Hairstyle Recommender"
      className={
        isStudio
          ? 'rounded-2xl border border-[#E4E5E8] bg-[#FFFFFF] p-5 sm:p-6 shadow-xs space-y-5'
          : 'overflow-hidden rounded-3xl border border-[#303239] bg-[#17181C] p-5 text-[#F5F5F6] shadow-lg space-y-4'
      }
    >
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${
              isStudio
                ? 'bg-[#101114] text-[#D5A63C]'
                : 'border border-[#D5A63C]/40 bg-[#202127] text-[#F2C45B]'
            }`}
          >
            <Sparkles className="h-5 w-5" aria-hidden />
          </span>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2
                className={`text-[17px] font-black tracking-tight ${
                  isStudio ? 'text-[#18191C]' : 'text-[#F5F5F6]'
                }`}
              >
                Face Shape &amp; Hairstyle Recommender
              </h2>
              <span
                className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider ${
                  isStudio
                    ? 'bg-[#D5A63C]/15 text-[#9A7420]'
                    : 'bg-[#D5A63C] text-[#101114]'
                }`}
              >
                Style AI
              </span>
            </div>
            <p
              className={`mt-0.5 text-[12.5px] ${
                isStudio ? 'text-[#5D626A]' : 'text-[#B5B5BC]'
              }`}
            >
              Find flattering haircuts &amp; beard proportions tailored to your face structure. Photos stay strictly on-device unless Vision AI is active.
            </p>
          </div>
        </div>

        {/* Mode Switcher */}
        <div
          className={`inline-flex rounded-xl p-1 shrink-0 ${
            isStudio
              ? 'border border-[#E4E5E8] bg-[#F5F6F8]'
              : 'border border-[#303239] bg-[#101114]'
          }`}
        >
          <button
            type="button"
            onClick={() => setMode('photo')}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
              mode === 'photo'
                ? 'bg-[#D5A63C] text-[#101114]'
                : isStudio
                  ? 'text-[#5D626A] hover:text-[#18191C]'
                  : 'text-[#B5B5BC] hover:text-[#F5F5F6]'
            }`}
          >
            <Camera className="h-3.5 w-3.5" aria-hidden />
            Selfie Scan
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('caliper');
              if (!result) setResult(classifyFaceGeometry(metrics));
            }}
            className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12px] font-bold transition-colors cursor-pointer ${
              mode === 'caliper'
                ? 'bg-[#D5A63C] text-[#101114]'
                : isStudio
                  ? 'text-[#5D626A] hover:text-[#18191C]'
                  : 'text-[#B5B5BC] hover:text-[#F5F5F6]'
            }`}
          >
            <Ruler className="h-3.5 w-3.5" aria-hidden />
            Proportions Guide
          </button>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-xl border border-[#EF4444]/40 bg-[#EF4444]/10 px-3.5 py-2.5 text-[12.5px] font-semibold text-[#EF4444]"
        >
          {error}
        </div>
      )}

      {/* Upload / Camera Zone */}
      {mode === 'photo' && (
        <div className="space-y-3">
          {cameraOpen ? (
            <div className="space-y-3 rounded-2xl border border-[#303239] bg-[#101114] p-3">
              <div className="relative mx-auto max-w-[300px] overflow-hidden rounded-xl aspect-[3/4] bg-black">
                <video
                  ref={videoRef}
                  playsInline
                  muted
                  className="h-full w-full object-cover"
                />
                {/* Crisp alignment bracket — zero bouncing halo circles */}
                <div className="pointer-events-none absolute inset-6 rounded-2xl border border-dashed border-[#D5A63C]/70" />
              </div>
              <div className="flex items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={stopCamera}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl border border-[#303239] bg-[#202127] px-4 text-[12.5px] font-bold text-[#F5F5F6] cursor-pointer"
                >
                  <X className="h-4 w-4" aria-hidden /> Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCaptureSelfie}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#D5A63C] px-5 text-[13px] font-extrabold text-[#101114] hover:bg-[#F2C45B] cursor-pointer"
                >
                  <Camera className="h-4 w-4" aria-hidden /> Capture &amp; Analyze
                </button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                onChange={handleFileChange}
              />
              <button
                type="button"
                disabled={analyzing}
                onClick={() => fileInputRef.current?.click()}
                className={`flex min-h-[54px] items-center justify-center gap-2 rounded-xl border px-4 py-3 text-[13px] font-bold transition-colors cursor-pointer ${
                  isStudio
                    ? 'border-[#E4E5E8] bg-[#F5F6F8] text-[#18191C] hover:border-[#D5A63C]'
                    : 'border-[#303239] bg-[#202127] text-[#F5F5F6] hover:border-[#D5A63C]'
                }`}
              >
                <Upload className="h-4 w-4 text-[#D5A63C]" aria-hidden />
                {analyzing ? 'Analyzing Face Proportions…' : 'Upload Front Selfie'}
              </button>
              <button
                type="button"
                disabled={analyzing}
                onClick={() => void handleOpenCamera()}
                className="flex min-h-[54px] items-center justify-center gap-2 rounded-xl bg-[#D5A63C] px-4 py-3 text-[13px] font-extrabold text-[#101114] hover:bg-[#F2C45B] transition-colors cursor-pointer"
              >
                <Camera className="h-4 w-4" aria-hidden />
                Take Live Camera Check
              </button>
            </div>
          )}
        </div>
      )}

      {/* Precision Proportion Sliders (Available in Caliper Mode OR after Photo Upload for fine tuning) */}
      {(mode === 'caliper' || (previewUrl && result)) && (
        <div
          className={`rounded-2xl border p-4 space-y-3.5 ${
            isStudio
              ? 'border-[#E4E5E8] bg-[#F5F6F8]'
              : 'border-[#303239] bg-[#101114]'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span
              className={`text-[11px] font-extrabold uppercase tracking-wider ${
                isStudio ? 'text-[#5D626A]' : 'text-[#B5B5BC]'
              }`}
            >
              {mode === 'caliper'
                ? 'Quick Facial Proportion Caliper'
                : caliperAdjusted
                  ? 'Fine-Tuned Facial Proportions'
                  : 'Optional: Fine-Tune Photo Calipers'}
            </span>
            <div className="inline-flex rounded-lg border border-[#303239]/25 overflow-hidden text-[11px] font-bold">
              {(['male', 'female'] as FaceGender[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => updateMetric('gender', g)}
                  className={`px-2.5 py-1 capitalize cursor-pointer ${
                    metrics.gender === g
                      ? 'bg-[#D5A63C] text-[#101114]'
                      : isStudio
                        ? 'bg-[#FFFFFF] text-[#5D626A]'
                        : 'bg-[#202127] text-[#B5B5BC]'
                  }`}
                >
                  {g === 'male' ? "Men's Cuts" : "Women's Cuts"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            {(
              [
                ['foreheadWidth', 'Forehead Width', 50, 100],
                ['cheekboneWidth', 'Cheekbone Width', 50, 100],
                ['jawWidth', 'Jawline Width', 45, 100],
                ['faceLength', 'Face Height / Length', 65, 118],
              ] as const
            ).map(([key, label, min, max]) => (
              <label key={key} className="block space-y-1">
                <span className="flex items-center justify-between text-[11.5px] font-semibold">
                  <span className={isStudio ? 'text-[#18191C]' : 'text-[#F5F5F6]'}>
                    {label}
                  </span>
                  <span className="font-mono text-[#D5A63C] tabular-nums">
                    {metrics[key]}
                  </span>
                </span>
                <input
                  type="range"
                  min={min}
                  max={max}
                  value={metrics[key]}
                  onChange={(e) => updateMetric(key, Number(e.target.value))}
                  className="w-full accent-[#D5A63C] cursor-pointer"
                />
              </label>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span
              className={`mr-1 text-[11px] font-bold ${
                isStudio ? 'text-[#5D626A]' : 'text-[#B5B5BC]'
              }`}
            >
              Jawline Shape:
            </span>
            {(
              [
                ['angular', 'Sharp / Square'],
                ['rounded', 'Soft / Rounded'],
                ['tapered', 'Tapered'],
                ['pointed', 'Pointed Chin'],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => updateMetric('jawContour', val)}
                className={`rounded-lg px-2.5 py-1 text-[11px] font-bold cursor-pointer ${
                  metrics.jawContour === val
                    ? 'bg-[#D5A63C] text-[#101114]'
                    : isStudio
                      ? 'border border-[#E4E5E8] bg-[#FFFFFF] text-[#5D626A]'
                      : 'border border-[#303239] bg-[#202127] text-[#B5B5BC]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Results View */}
      {result && (
        <div
          className={`rounded-2xl border p-4 sm:p-5 space-y-4 ${
            isStudio
              ? 'border-[#E4E5E8] bg-[#FFFFFF]'
              : 'border-[#D5A63C]/40 bg-[#202127]'
          }`}
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3.5 min-w-0 flex-1">
              <img
                src={previewUrl || result.previewImage}
                alt={`${result.faceShape} hairstyle lookbook reference`}
                className="h-20 w-20 shrink-0 rounded-2xl object-cover border border-[#D5A63C]/40 bg-[#101114]"
                loading="lazy"
              />
              <div className="min-w-0 space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-md bg-[#D5A63C] px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-[#101114]">
                    {result.gender === 'female' ? 'Female Profile' : 'Male Profile'}
                  </span>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[10px] font-bold ${
                      isStudio
                        ? 'bg-[#F5F6F8] text-[#5D626A]'
                        : 'bg-[#101114] text-[#B5B5BC]'
                    }`}
                  >
                    {result.source === 'geometric_caliper'
                      ? 'Geometric Analysis'
                      : 'Vision AI Analysis'}
                  </span>
                </div>
                <h3
                  className={`text-[20px] font-black leading-tight ${
                    isStudio ? 'text-[#18191C]' : 'text-[#F5F5F6]'
                  }`}
                >
                  {result.faceShape} Face Shape
                </h3>
                <div className="flex items-center gap-2">
                  <div className="h-1.5 w-28 overflow-hidden rounded-full bg-[#303239]/40">
                    <div
                      className="h-full rounded-full bg-[#D5A63C]"
                      style={{ width: `${Math.round(result.confidence * 100)}%` }}
                    />
                  </div>
                  <span className="text-[11px] font-bold text-[#22C55E] tabular-nums">
                    {Math.round(result.confidence * 100)}% Match
                  </span>
                </div>
              </div>
            </div>

            {previewUrl && (
              <button
                type="button"
                onClick={() => {
                  setPreviewUrl(null);
                  setResult(null);
                }}
                className={`inline-flex h-8 items-center gap-1 self-start rounded-lg border px-2.5 text-[11px] font-bold cursor-pointer ${
                  isStudio
                    ? 'border-[#E4E5E8] text-[#5D626A] hover:text-[#18191C]'
                    : 'border-[#303239] text-[#B5B5BC] hover:text-[#F5F5F6]'
                }`}
              >
                <RefreshCw className="h-3 w-3" aria-hidden /> New Photo
              </button>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {/* Observed Traits */}
            <div
              className={`rounded-xl border p-3.5 space-y-2 ${
                isStudio
                  ? 'border-[#E4E5E8] bg-[#F5F6F8]'
                  : 'border-[#303239] bg-[#17181C]'
              }`}
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#D5A63C]">
                Key Facial Proportions
              </p>
              <ul className="space-y-1.5 text-[12px]">
                {result.characteristics.map((item, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <UserCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#22C55E]" aria-hidden />
                    <span className={isStudio ? 'text-[#18191C]' : 'text-[#F5F5F6]'}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Recommended Hairstyles */}
            <div
              className={`rounded-xl border p-3.5 space-y-2 ${
                isStudio
                  ? 'border-[#E4E5E8] bg-[#F5F6F8]'
                  : 'border-[#303239] bg-[#17181C]'
              }`}
            >
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#D5A63C]">
                Best Hairstyles for You
              </p>
              <ul className="space-y-1.5 text-[12px]">
                {result.recommendations.map((rec, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <Scissors className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#D5A63C]" aria-hidden />
                    <span className={isStudio ? 'text-[#18191C]' : 'text-[#F5F5F6]'}>
                      {rec}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Beard & Barber Ask Strip */}
          <div
            className={`rounded-xl border p-3.5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between ${
              isStudio
                ? 'border-[#D5A63C]/40 bg-[#D5A63C]/10'
                : 'border-[#D5A63C]/35 bg-[#101114]'
            }`}
          >
            <div className="min-w-0 space-y-0.5">
              <p className="text-[11px] font-extrabold uppercase tracking-wider text-[#D5A63C]">
                What to Ask Your Barber ({result.faceShape})
              </p>
              <p
                className={`text-[12.5px] font-semibold ${
                  isStudio ? 'text-[#18191C]' : 'text-[#F5F5F6]'
                }`}
              >
                {result.barberPrompt} · {result.beardPairing}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => void handleCopyBarberScript()}
                className={`inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-bold cursor-pointer ${
                  isStudio
                    ? 'border-[#18191C]/20 bg-[#FFFFFF] text-[#18191C]'
                    : 'border-[#303239] bg-[#202127] text-[#F5F5F6]'
                }`}
              >
                {copiedPrompt ? (
                  <Check className="h-3.5 w-3.5 text-[#22C55E]" aria-hidden />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-[#D5A63C]" aria-hidden />
                )}
                {copiedPrompt ? 'Copied Spec' : 'Copy Spec'}
              </button>
              {onApplyRecommendation && (
                <button
                  type="button"
                  onClick={() => onApplyRecommendation(result.barberPrompt, result)}
                  className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-[#D5A63C] px-3.5 text-[12px] font-extrabold text-[#101114] hover:bg-[#F2C45B] cursor-pointer"
                >
                  Apply to Booking →
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
