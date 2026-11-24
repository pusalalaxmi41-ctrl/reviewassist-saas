import { useRef, useState } from 'react';
import { Dumbbell, Minimize2, Pause, Play, Video } from 'lucide-react';
import type { GymAnimationKey } from '../../types/gym';
import { BUILTIN_GYM_CATALOG_EXERCISES } from '../../utils/gymWorkoutEngine';
import { resolveAnatomyAssetForMuscles } from './member/gymAssets';

interface ExerciseAnimationPreviewProps {
  animationKey?: GymAnimationKey | null;
  animationGifUrl?: string | null;
  exerciseName?: string;
  muscleGroup?: string;
  variant?: 'compact' | 'stage';
  className?: string;
  onMinimize?: () => void;
}

const BUILTIN_GIF_BY_NAME = new Map<string, string>(
  BUILTIN_GYM_CATALOG_EXERCISES.filter((e) => e.animationGifUrl).map((e) => [
    e.name.trim().toLowerCase(),
    e.animationGifUrl as string,
  ]),
);

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url.trim());
}

/**
 * Pure studio white-stage animated GIF & looping video preview.
 * Falls back cleanly to dark-studio muscle anatomy photography for custom
 * movements without uploaded media (zero cartoon vector figures).
 */
export function ExerciseAnimationPreview({
  animationGifUrl,
  exerciseName = 'Exercise',
  muscleGroup,
  variant = 'compact',
  className = '',
  onMinimize,
}: ExerciseAnimationPreviewProps) {
  const builtinUrl =
    BUILTIN_GIF_BY_NAME.get(exerciseName.trim().toLowerCase()) ?? '';
  const cleanUrl = animationGifUrl?.trim() || builtinUrl || '';

  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [pausedKey, setPausedKey] = useState<string | null>(null);
  const [frozenGifFrame, setFrozenGifFrame] = useState<string | null>(null);
  const [anatomyFailed, setAnatomyFailed] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);

  const mediaFailed = Boolean(cleanUrl && failedUrl === cleanUrl);
  const paused = pausedKey === cleanUrl;
  const isStage = variant === 'stage';

  const mediaFrameClass = isStage
    ? `relative overflow-hidden rounded-2xl bg-white border border-slate-200 w-full h-56 flex items-center justify-center shadow-sm ${className}`
    : `relative overflow-hidden rounded-xl bg-white border border-slate-200 w-12 h-12 shrink-0 flex items-center justify-center ${className}`;

  const fallbackFrameClass = isStage
    ? `relative overflow-hidden rounded-2xl bg-[#111419] border border-white/10 w-full h-56 flex items-center justify-center shadow-sm ${className}`
    : `relative overflow-hidden rounded-xl bg-[#111419] border border-white/10 w-12 h-12 shrink-0 flex items-center justify-center ${className}`;

  function handleToggleMediaPause(isVideo: boolean) {
    if (!cleanUrl) return;
    const nextPaused = !paused;
    setPausedKey(nextPaused ? cleanUrl : null);

    if (isVideo) {
      if (videoRef.current) {
        if (nextPaused) videoRef.current.pause();
        else void videoRef.current.play().catch(() => {});
      }
      return;
    }

    if (!nextPaused) {
      setFrozenGifFrame(null);
      return;
    }

    const imgEl = imgRef.current;
    if (imgEl && imgEl.naturalWidth > 0 && typeof document !== 'undefined') {
      try {
        const canvas = document.createElement('canvas');
        canvas.width = imgEl.naturalWidth;
        canvas.height = imgEl.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(imgEl, 0, 0);
          setFrozenGifFrame(canvas.toDataURL('image/png'));
          return;
        }
      } catch {
        // Cross-origin GIF fallback: freeze indicator cleanly
      }
    }
    setFrozenGifFrame(cleanUrl);
  }

  if (cleanUrl && !mediaFailed) {
    const isVideo = isVideoMediaUrl(cleanUrl);
    return (
      <div className={mediaFrameClass}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={cleanUrl}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setFailedUrl(cleanUrl)}
            className="h-full w-full object-contain bg-white"
          />
        ) : (
          <img
            ref={imgRef}
            src={paused && frozenGifFrame ? frozenGifFrame : cleanUrl}
            alt={`${exerciseName} demonstration`}
            loading={isStage ? 'eager' : 'lazy'}
            decoding="async"
            onError={() => setFailedUrl(cleanUrl)}
            className="h-full w-full object-contain p-1 bg-white"
          />
        )}
        {isStage && isVideo && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/75 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
            <Video className="h-3 w-3" aria-hidden />
            Real Form Video
          </span>
        )}
        {isStage && (
          <button
            type="button"
            onClick={() => handleToggleMediaPause(isVideo)}
            className="absolute bottom-2.5 right-2.5 inline-flex min-h-[34px] items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-slate-900 cursor-pointer"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3 fill-current" aria-hidden />
                <span>tap to resume</span>
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" aria-hidden />
                <span>tap to pause</span>
              </>
            )}
          </button>
        )}
        {isStage && onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            className="absolute bottom-2.5 left-2.5 inline-flex min-h-[34px] items-center gap-1 rounded-full bg-slate-900/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-slate-900 cursor-pointer"
          >
            <Minimize2 className="h-3 w-3" aria-hidden />
            <span>Minimize</span>
          </button>
        )}
      </div>
    );
  }

  const anatomySrc = resolveAnatomyAssetForMuscles(
    muscleGroup ? [muscleGroup] : [],
    exerciseName,
  );

  return (
    <div
      className={fallbackFrameClass}
      aria-label={`${exerciseName} target muscle focus`}
    >
      {!anatomyFailed ? (
        <img
          src={anatomySrc}
          alt={`${exerciseName} target muscles`}
          loading={isStage ? 'eager' : 'lazy'}
          decoding="async"
          onError={() => setAnatomyFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        <Dumbbell className="h-6 w-6 text-[#778191]" aria-hidden />
      )}
      {isStage && (
        <span className="absolute top-2.5 left-2.5 rounded-full border border-white/15 bg-[#0B0D10]/80 px-2.5 py-0.5 text-[10.5px] font-bold capitalize text-[#F5F7FA] backdrop-blur-xs">
          Target: {muscleGroup || 'Full Body'}
        </span>
      )}
      {isStage && onMinimize && (
        <button
          type="button"
          onClick={onMinimize}
          className="absolute bottom-2.5 left-2.5 inline-flex min-h-[34px] items-center gap-1 rounded-full bg-[#0B0D10]/80 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-[#0B0D10] cursor-pointer"
        >
          <Minimize2 className="h-3 w-3" aria-hidden />
          <span>Minimize</span>
        </button>
      )}
    </div>
  );
}
