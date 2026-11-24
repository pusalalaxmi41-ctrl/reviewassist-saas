import { useRef, useState } from 'react';
import { Minimize2, Pause, Play, Video } from 'lucide-react';
import type { GymAnimationKey } from '../../types/gym';
import { inferGymAnimationKey } from '../../utils/gymWorkoutEngine';

interface ExerciseAnimationPreviewProps {
  animationKey?: GymAnimationKey | null;
  animationGifUrl?: string | null;
  exerciseName?: string;
  muscleGroup?: string;
  variant?: 'compact' | 'stage';
  className?: string;
  onMinimize?: () => void;
}

function isVideoMediaUrl(url: string): boolean {
  return /\.(mp4|webm|mov|m4v)(\?|#|$)/i.test(url.trim());
}

/** Crisp studio-grade demonstration supporting real-person MP4/WebM loops, GIFs, and anatomical SVG fallback. */
export function ExerciseAnimationPreview({
  animationKey,
  animationGifUrl,
  exerciseName = 'Exercise',
  muscleGroup,
  variant = 'compact',
  className = '',
  onMinimize,
}: ExerciseAnimationPreviewProps) {
  const cleanUrl = animationGifUrl?.trim() || '';
  const [failedUrl, setFailedUrl] = useState<string | null>(null);
  const [pausedKey, setPausedKey] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const mediaFailed = Boolean(cleanUrl && failedUrl === cleanUrl);
  const paused = pausedKey === (cleanUrl || 'svg');

  const resolvedKey: GymAnimationKey =
    animationKey ?? inferGymAnimationKey(exerciseName, muscleGroup);

  const isStage = variant === 'stage';
  const frameClass = isStage
    ? `relative overflow-hidden rounded-2xl bg-white border border-slate-200 w-full h-56 flex items-center justify-center shadow-sm ${className}`
    : `relative overflow-hidden rounded-xl bg-white border border-slate-200 w-12 h-12 shrink-0 flex items-center justify-center ${className}`;

  if (cleanUrl && !mediaFailed) {
    const isVideo = isVideoMediaUrl(cleanUrl);
    return (
      <div className={frameClass}>
        {isVideo ? (
          <video
            ref={videoRef}
            src={cleanUrl}
            autoPlay
            loop
            muted
            playsInline
            onError={() => setFailedUrl(cleanUrl)}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={cleanUrl}
            alt={`${exerciseName} real-person demonstration`}
            onError={() => setFailedUrl(cleanUrl)}
            className="h-full w-full object-cover"
          />
        )}
        {isStage && (
          <span className="absolute top-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-0.5 text-[10px] font-bold text-white backdrop-blur-xs">
            <Video className="h-3 w-3" aria-hidden />
            {isVideo ? 'Real Form Video' : 'Real Form Loop'}
          </span>
        )}
        {isStage && isVideo && (
          <button
            type="button"
            onClick={() => {
              const nextPaused = !paused;
              setPausedKey(nextPaused ? cleanUrl : null);
              if (videoRef.current) {
                if (nextPaused) videoRef.current.pause();
                else void videoRef.current.play().catch(() => {});
              }
            }}
            className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/80 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs cursor-pointer"
          >
            {paused ? (
              <>
                <Play className="h-3 w-3" aria-hidden /> Play
              </>
            ) : (
              <>
                <Pause className="h-3 w-3" aria-hidden /> Pause
              </>
            )}
          </button>
        )}
        {isStage && onMinimize && (
          <button
            type="button"
            onClick={onMinimize}
            className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/75 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur-xs cursor-pointer"
          >
            <Minimize2 className="h-3 w-3" aria-hidden /> Minimize
          </button>
        )}
      </div>
    );
  }

  const playStyle = paused ? { animationPlayState: 'paused' as const } : undefined;

  return (
    <div
      className={frameClass}
      aria-label={`${exerciseName} anatomical muscle demonstration`}
    >
      <svg
        viewBox="0 0 240 160"
        className={isStage ? 'h-full w-full p-2' : 'h-11 w-11'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="anatMuscleHot" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#EF4444" />
            <stop offset="100%" stopColor="#F97316" />
          </linearGradient>
          <linearGradient id="anatBodyShade" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F1F5F9" />
            <stop offset="100%" stopColor="#CBD5E1" />
          </linearGradient>
          <linearGradient id="anatFrameMetal" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#E2E8F0" />
            <stop offset="100%" stopColor="#94A3B8" />
          </linearGradient>
        </defs>

        {/* Ground Shadow */}
        <ellipse cx="120" cy="148" rx="82" ry="5" fill="#E2E8F0" fillOpacity="0.65" />

        {/* ==================== 1. BENCH PRESS & INCLINE PRESS ==================== */}
        {(resolvedKey === 'bench_press' || resolvedKey === 'incline_press') && (
          <g>
            {/* Olympic Rack & Weight Bench */}
            <rect x="46" y="42" width="5" height="104" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            <rect x="188" y="42" width="5" height="104" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            <g transform={resolvedKey === 'incline_press' ? 'rotate(-18 118 106)' : undefined}>
              <rect x="64" y="102" width="110" height="11" rx="4" fill="#334155" stroke="#0F172A" strokeWidth="1.2" />
              <rect x="78" y="113" width="8" height="33" rx="2" fill="#64748B" />
              <rect x="152" y="113" width="8" height="33" rx="2" fill="#64748B" />
            </g>

            {/* Ghosted Start Position */}
            <g opacity="0.22" transform={resolvedKey === 'incline_press' ? 'rotate(-16 118 96)' : undefined}>
              <ellipse cx="74" cy="90" rx="9" ry="9" fill="#CBD5E1" stroke="#64748B" />
              <path d="M84 86 Q116 80 148 88 L148 101 L84 101 Z" fill="#CBD5E1" />
              <line x1="60" y1="74" x2="176" y2="74" stroke="#64748B" strokeWidth="3.5" />
            </g>

            {/* Anatomical Athlete Torso + Highlighted Pectorals & Triceps */}
            <g transform={resolvedKey === 'incline_press' ? 'rotate(-16 118 96)' : undefined}>
              {/* Head & Neck */}
              <circle cx="72" cy="89" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              {/* Athletic Quads on Floor */}
              <path d="M148 93 L172 95 L182 138 L170 140 L162 104 L146 102 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.4" />
              {/* Torso */}
              <path d="M82 86 Q102 78 128 84 L150 90 L150 102 L82 101 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              {/* Active Chest Muscle Fiber Highlight (Pecs) */}
              <path d="M90 83 Q106 76 118 84 L112 96 L88 94 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
              {/* Anterior Deltoid Highlight */}
              <circle cx="91" cy="88" r="6" fill="#F97316" fillOpacity="0.85" stroke="#991B1B" strokeWidth="0.9" />
            </g>

            {/* Animated Press Arms + Olympic Barbell & Plates */}
            <g className="gym-ex-press" style={playStyle}>
              {/* Anatomical Arm Pressing */}
              <path d="M92 84 L96 58 L108 42 L114 44 L106 60 L102 84 Z" fill="url(#anatMuscleHot)" stroke="#1E293B" strokeWidth="1.3" />
              {/* Barbell Shaft */}
              <line x1="42" y1="42" x2="198" y2="42" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
              {/* Outer 20kg Plates */}
              <rect x="46" y="24" width="9" height="36" rx="2.5" fill="#1E293B" stroke="#0F172A" />
              <rect x="57" y="28" width="6" height="28" rx="2" fill="#EF4444" />
              <rect x="185" y="24" width="9" height="36" rx="2.5" fill="#1E293B" stroke="#0F172A" />
              <rect x="177" y="28" width="6" height="28" rx="2" fill="#EF4444" />
            </g>
          </g>
        )}

        {/* ==================== 2. LAT PULLDOWN / CABLE CROSSOVER ==================== */}
        {resolvedKey === 'lat_pulldown' && (
          <g>
            {/* Cable Crossover Tower & Dual Weight Stacks */}
            <rect x="34" y="18" width="172" height="6" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            <rect x="36" y="24" width="7" height="122" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            <rect x="197" y="24" width="7" height="122" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            {/* Left & Right Weight Stacks */}
            <rect x="45" y="90" width="18" height="44" rx="2" fill="#1E293B" stroke="#0F172A" />
            <rect x="177" y="90" width="18" height="44" rx="2" fill="#1E293B" stroke="#0F172A" />

            {/* Ghosted Start Pose (Arms Extended Wide) */}
            <g opacity="0.22">
              <circle cx="120" cy="48" r="9" fill="#CBD5E1" />
              <path d="M104 60 L136 60 L130 98 L110 98 Z" fill="#CBD5E1" />
              <path d="M104 64 L78 46" stroke="#EF4444" strokeWidth="7" strokeLinecap="round" />
              <path d="M136 64 L162 46" stroke="#EF4444" strokeWidth="7" strokeLinecap="round" />
            </g>

            {/* Standing / Kneeling Anatomical Bodybuilder */}
            {/* Athletic Legs */}
            <path d="M111 98 L104 142 L114 143 L119 106 L121 106 L126 143 L136 142 L129 98 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.4" />
            {/* Torso + Ab Definition */}
            <path d="M102 60 Q120 56 138 60 L131 99 L109 99 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
            {/* Crimson/Coral Highlighted Lats & Teres Major */}
            <path d="M103 63 Q96 76 110 92 L114 68 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
            <path d="M137 63 Q144 76 130 92 L126 68 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
            {/* Shorts */}
            <path d="M108 94 L132 94 L134 109 L106 109 Z" fill="#1E293B" />
            {/* Head */}
            <circle cx="120" cy="46" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />

            {/* Animated Pulldown Bar + Arms Contracting Lats */}
            <g className="gym-ex-pull" style={playStyle}>
              {/* Dynamic Cables to Top Pulleys */}
              <line x1="43" y1="24" x2="72" y2="38" stroke="#334155" strokeWidth="1.5" />
              <line x1="197" y1="24" x2="168" y2="38" stroke="#334155" strokeWidth="1.5" />
              {/* Pulldown Bar */}
              <path d="M68 40 Q120 34 172 40" stroke="#1E293B" strokeWidth="4" strokeLinecap="round" />
              {/* Anatomical Arms */}
              <path d="M103 63 L85 52 L73 40" stroke="#94A3B8" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M137 63 L155 52 L167 40" stroke="#94A3B8" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
              <circle cx="72" cy="40" r="3.5" fill="#1E293B" />
              <circle cx="168" cy="40" r="3.5" fill="#1E293B" />
            </g>
          </g>
        )}

        {/* ==================== 3. CABLE ROW / BARBELL ROW / DEADLIFT ==================== */}
        {resolvedKey === 'cable_row' && (
          <g>
            {/* Pulley Tower */}
            <rect x="34" y="26" width="12" height="118" rx="3" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            <rect x="46" y="76" width="16" height="46" rx="2" fill="#1E293B" />
            <circle cx="54" cy="90" r="5" fill="#EF4444" stroke="#1E293B" />
            {/* Seated Bench */}
            <rect x="108" y="106" width="66" height="9" rx="3" fill="#334155" stroke="#0F172A" />
            <rect x="120" y="115" width="7" height="29" fill="#64748B" />
            <rect x="158" y="115" width="7" height="29" fill="#64748B" />

            {/* Ghosted Reach Pose */}
            <g opacity="0.22">
              <path d="M148 56 L124 88 L90 88" stroke="#CBD5E1" strokeWidth="9" strokeLinecap="round" />
            </g>

            {/* Seated Athlete + Highlighted Mid-Back / Rhomboids & Rear Delts */}
            <circle cx="152" cy="48" r="9" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
            <path d="M142 58 L160 58 L156 105 L136 105 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
            {/* Crimson Mid-Back / Lat Fiber Highlight */}
            <path d="M143 61 L157 61 L154 90 L141 84 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
            {/* Extended Legs Braced on Footplate */}
            <path d="M138 100 L92 104 L62 114 L65 122 L95 113 L142 109 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.4" />
            <rect x="54" y="102" width="12" height="28" rx="2" fill="#64748B" />

            {/* Animated Rowing Arm & Cable Handle */}
            <g className="gym-ex-row" style={playStyle}>
              <line x1="54" y1="90" x2="104" y2="86" stroke="#334155" strokeWidth="2" />
              <rect x="102" y="79" width="7" height="14" rx="2" fill="#1E293B" />
              <path d="M148 65 L126 84 L106 86" stroke="url(#anatMuscleHot)" strokeWidth="7.5" strokeLinecap="round" strokeLinejoin="round" />
            </g>
          </g>
        )}

        {/* ==================== 4. SQUAT / LEG PRESS / LUNGE ==================== */}
        {(resolvedKey === 'squat' || resolvedKey === 'leg_press') && (
          <g>
            {/* Squat Rack Uprights */}
            <rect x="52" y="24" width="6" height="122" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />
            <rect x="182" y="24" width="6" height="122" rx="2" fill="url(#anatFrameMetal)" stroke="#475569" strokeWidth="1" />

            {/* Ghosted Top Pose (Reference Screenshot #1) */}
            <g opacity="0.22">
              <circle cx="94" cy="36" r="9" fill="#CBD5E1" />
              <rect x="82" y="47" width="24" height="36" rx="6" fill="#CBD5E1" />
              <path d="M84 82 L80 132 L88 132 L92 88 L98 88 L102 132 L110 132 L104 82 Z" fill="#EF4444" />
            </g>

            {/* Stationary Lower Feet & Cones */}
            <ellipse cx="122" cy="142" rx="9" ry="4" fill="#334155" />
            <ellipse cx="148" cy="142" rx="9" ry="4" fill="#334155" />

            {/* Animated Squatting Anatomical Figure with Red-Highlighted Quads & Glutes */}
            <g className="gym-ex-squat" style={playStyle}>
              {/* Torso */}
              <path d="M122 50 Q135 46 148 50 L145 86 L125 86 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              {/* Athletic Shorts */}
              <path d="M124 82 L146 82 L149 95 L121 95 Z" fill="#1E293B" />
              {/* Highlighted Quadriceps (Crimson/Coral) */}
              <path d="M122 92 L114 118 L124 122 L131 94 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
              <path d="M148 92 L156 118 L146 122 L139 94 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
              {/* Lower Calves */}
              <path d="M116 118 L120 140 L127 140 L123 118 Z" fill="url(#anatMuscleHot)" stroke="#1E293B" strokeWidth="1.2" />
              <path d="M154 118 L150 140 L143 140 L147 118 Z" fill="url(#anatMuscleHot)" stroke="#1E293B" strokeWidth="1.2" />
              {/* Head */}
              <circle cx="135" cy="37" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              {/* Barbell Across Upper Traps */}
              <line x1="78" y1="50" x2="192" y2="50" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="78" y="34" width="8" height="32" rx="2" fill="#1E293B" />
              <rect x="88" y="37" width="5" height="26" rx="1.5" fill="#EF4444" />
              <rect x="184" y="34" width="8" height="32" rx="2" fill="#1E293B" />
              <rect x="177" y="37" width="5" height="26" rx="1.5" fill="#EF4444" />
            </g>
          </g>
        )}

        {/* ==================== 5. SHOULDER PRESS / LATERAL RAISE ==================== */}
        {resolvedKey === 'shoulder_press' && (
          <g>
            {/* Seated Weight Bench */}
            <rect x="108" y="54" width="24" height="58" rx="4" fill="#334155" stroke="#0F172A" />
            <rect x="98" y="108" width="44" height="9" rx="3" fill="#334155" stroke="#0F172A" />
            <line x1="120" y1="117" x2="120" y2="144" stroke="#64748B" strokeWidth="6" />

            {/* Athlete + Highlighted Deltoids */}
            <path d="M104 62 Q120 56 136 62 L131 107 L109 107 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
            <path d="M107 104 L96 142 L106 142 L114 110 L126 110 L134 142 L144 142 L133 104 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.4" />
            {/* Crimson/Coral Anterior & Lateral Deltoids */}
            <circle cx="101" cy="65" r="7.5" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
            <circle cx="139" cy="65" r="7.5" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
            <circle cx="120" cy="44" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />

            {/* Animated Overhead Press Bar + Arms */}
            <g className="gym-ex-press" style={playStyle}>
              <path d="M99 64 L84 44 L86 24" stroke="url(#anatMuscleHot)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M141 64 L156 44 L154 24" stroke="url(#anatMuscleHot)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round" />
              <line x1="66" y1="24" x2="174" y2="24" stroke="#1E293B" strokeWidth="3.5" strokeLinecap="round" />
              <rect x="64" y="13" width="8" height="22" rx="2" fill="#EF4444" stroke="#1E293B" />
              <rect x="168" y="13" width="8" height="22" rx="2" fill="#EF4444" stroke="#1E293B" />
            </g>
          </g>
        )}

        {/* ==================== 6. BICEP CURL & TRICEP PUSHDOWN ==================== */}
        {(resolvedKey === 'bicep_curl' || resolvedKey === 'tricep_pushdown') && (
          <g>
            {/* Standing Athlete Figure */}
            <circle cx="108" cy="36" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
            <path d="M94 49 Q108 45 122 49 L118 92 L98 92 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
            <path d="M97 88 L119 88 L121 102 L95 102 Z" fill="#1E293B" />
            <path d="M96 100 L92 142 L102 142 L106 104 L110 104 L114 142 L124 142 L119 100 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.4" />
            {/* Highlighted Bicep / Tricep Upper Arm */}
            <rect x="115" y="51" width="11" height="27" rx="5" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />

            {/* Forearm & Dumbbell / Cable Attachment */}
            <g
              className={resolvedKey === 'bicep_curl' ? 'gym-ex-curl' : 'gym-ex-pull'}
              style={playStyle}
            >
              <line x1="120" y1="75" x2="154" y2="75" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
              <rect x="148" y="65" width="7" height="20" rx="2" fill="#1E293B" />
              <rect x="157" y="68" width="5" height="14" rx="1.5" fill="#EF4444" />
            </g>
          </g>
        )}

        {/* ==================== 7. CORE / ABS ==================== */}
        {resolvedKey === 'core_plank' && (
          <g>
            {/* Exercise Mat */}
            <rect x="34" y="130" width="172" height="8" rx="4" fill="#334155" />
            <g className="gym-ex-press" style={playStyle}>
              <circle cx="62" cy="86" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              <path d="M72 88 L142 96 L140 112 L70 104 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              {/* Highlighted Six-Pack Rectus Abdominis */}
              <rect x="92" y="92" width="38" height="12" rx="4" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
              <line x1="74" y1="100" x2="66" y2="128" stroke="#94A3B8" strokeWidth="7" strokeLinecap="round" />
              <line x1="142" y1="104" x2="184" y2="128" stroke="#94A3B8" strokeWidth="7.5" strokeLinecap="round" />
            </g>
          </g>
        )}

        {/* ==================== 8. CARDIO / HIIT / AGILITY ==================== */}
        {resolvedKey === 'cardio_hiit' && (
          <g>
            {/* Agility Cones */}
            {[56, 118, 178].map((cx) => (
              <polygon
                key={cx}
                points={`${cx},124 ${cx - 8},144 ${cx + 8},144`}
                fill="#CBD5E1"
                stroke="#64748B"
                strokeWidth="1"
              />
            ))}
            <g className="gym-ex-cardio" style={playStyle}>
              <circle cx="122" cy="36" r="9.5" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              <path d="M108 49 Q122 45 136 49 L132 86 L112 86 Z" fill="url(#anatBodyShade)" stroke="#1E293B" strokeWidth="1.5" />
              {/* Highlighted Quads & Calves */}
              <path d="M111 86 L102 114 L112 118 L120 88 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
              <path d="M133 86 L142 114 L132 118 L124 88 Z" fill="url(#anatMuscleHot)" stroke="#991B1B" strokeWidth="1" />
              <path d="M103 114 L106 138 L113 138 L111 116 Z" fill="url(#anatMuscleHot)" stroke="#1E293B" />
              <path d="M141 114 L138 138 L131 138 L133 116 Z" fill="url(#anatMuscleHot)" stroke="#1E293B" />
            </g>
          </g>
        )}
      </svg>

      {/* Reference Interactive Stage Controls: Minimize (Bottom-Left) + Tap to Pause (Bottom-Right) */}
      {isStage && (
        <>
          {onMinimize && (
            <button
              type="button"
              onClick={onMinimize}
              className="absolute bottom-2.5 left-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-slate-900 cursor-pointer"
            >
              <Minimize2 className="h-3 w-3" aria-hidden />
              <span>Minimize</span>
            </button>
          )}
          <button
            type="button"
            onClick={() => setPausedKey(paused ? null : cleanUrl || 'svg')}
            className="absolute bottom-2.5 right-2.5 inline-flex items-center gap-1 rounded-full bg-slate-900/70 px-3 py-1 text-[11px] font-bold text-white backdrop-blur-xs hover:bg-slate-900 cursor-pointer"
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
        </>
      )}
    </div>
  );
}
