import { useState } from 'react';
import type { GymAnimationKey } from '../../types/gym';
import { inferGymAnimationKey } from '../../utils/gymWorkoutEngine';

interface ExerciseAnimationPreviewProps {
  animationKey?: GymAnimationKey | null;
  animationGifUrl?: string | null;
  exerciseName?: string;
  muscleGroup?: string;
  variant?: 'compact' | 'stage';
  className?: string;
}

export function ExerciseAnimationPreview({
  animationKey,
  animationGifUrl,
  exerciseName = 'Exercise',
  muscleGroup,
  variant = 'compact',
  className = '',
}: ExerciseAnimationPreviewProps) {
  const [gifFailed, setGifFailed] = useState(false);

  const resolvedKey: GymAnimationKey =
    animationKey ?? inferGymAnimationKey(exerciseName, muscleGroup);

  const frameClass =
    variant === 'stage'
      ? `relative overflow-hidden rounded-2xl bg-[#1A1E26] border border-white/10 w-full h-40 flex items-center justify-center ${className}`
      : `relative overflow-hidden rounded-xl bg-[#1A1E26] border border-white/10 w-14 h-14 shrink-0 flex items-center justify-center ${className}`;

  if (animationGifUrl && !gifFailed) {
    return (
      <div className={frameClass}>
        <img
          src={animationGifUrl}
          alt={`${exerciseName} form demonstration`}
          onError={() => setGifFailed(true)}
          className="h-full w-full object-cover"
        />
      </div>
    );
  }

  return (
    <div className={frameClass} aria-label={`${exerciseName} form animation`}>
      {/* Subtle radial spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background:
            'radial-gradient(circle at 50% 45%, rgba(200, 241, 53, 0.18), transparent 68%)',
        }}
      />

      <svg
        viewBox="0 0 120 90"
        className={variant === 'stage' ? 'h-36 w-52' : 'h-12 w-12'}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Floor reference line */}
        <line
          x1="14"
          y1="78"
          x2="106"
          y2="78"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1.5"
          strokeLinecap="round"
        />

        {(resolvedKey === 'bench_press' || resolvedKey === 'incline_press') && (
          <g>
            {/* Bench */}
            <rect
              x="24"
              y="56"
              width="72"
              height="6"
              rx="3"
              fill="#2B313D"
              transform={
                resolvedKey === 'incline_press' ? 'rotate(-16 60 59)' : undefined
              }
            />
            <line x1="34" y1="62" x2="34" y2="78" stroke="#2B313D" strokeWidth="4" strokeLinecap="round" />
            <line x1="86" y1="62" x2="86" y2="78" stroke="#2B313D" strokeWidth="4" strokeLinecap="round" />
            {/* Lifter torso & head */}
            <circle cx="38" cy="48" r="6" fill="#64748B" />
            <rect x="44" y="47" width="32" height="8" rx="4" fill="#94A3B8" />
            {/* Animated Barbell & Arms */}
            <g className="gym-ex-press">
              <line x1="56" y1="48" x2="56" y2="30" stroke="#C8F135" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="28" y1="30" x2="92" y2="30" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
              <rect x="24" y="21" width="6" height="18" rx="2" fill="#C8F135" />
              <rect x="90" y="21" width="6" height="18" rx="2" fill="#C8F135" />
            </g>
          </g>
        )}

        {resolvedKey === 'lat_pulldown' && (
          <g>
            {/* Cable frame */}
            <line x1="60" y1="6" x2="60" y2="20" stroke="#475569" strokeWidth="2.5" strokeDasharray="3 2" />
            {/* Seat & Seated torso */}
            <rect x="44" y="64" width="32" height="5" rx="2.5" fill="#2B313D" />
            <circle cx="60" cy="40" r="6" fill="#64748B" />
            <rect x="54" y="47" width="12" height="18" rx="4" fill="#94A3B8" />
            {/* Animated Pulldown Bar */}
            <g className="gym-ex-pull">
              <line x1="60" y1="14" x2="60" y2="24" stroke="#C8F135" strokeWidth="2" />
              <path d="M26 24 Q60 20 94 24" stroke="#C8F135" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="36" y1="24" x2="54" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="84" y1="24" x2="66" y2="48" stroke="#CBD5E1" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>
        )}

        {resolvedKey === 'cable_row' && (
          <g>
            {/* Pulley */}
            <circle cx="18" cy="52" r="5" fill="#334155" stroke="#C8F135" strokeWidth="1.5" />
            {/* Seated athlete */}
            <rect x="50" y="64" width="34" height="5" rx="2.5" fill="#2B313D" />
            <circle cx="72" cy="36" r="6" fill="#64748B" />
            <rect x="65" y="43" width="14" height="20" rx="5" fill="#94A3B8" />
            {/* Animated Row Handle & Cable */}
            <g className="gym-ex-row">
              <line x1="22" y1="52" x2="48" y2="52" stroke="#C8F135" strokeWidth="2.5" strokeDasharray="3 2" />
              <rect x="46" y="46" width="6" height="12" rx="2" fill="#C8F135" />
              <line x1="50" y1="52" x2="66" y2="48" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
            </g>
          </g>
        )}

        {(resolvedKey === 'squat' || resolvedKey === 'leg_press') && (
          <g>
            {/* Stationary Feet */}
            <rect x="44" y="72" width="10" height="5" rx="2" fill="#64748B" />
            <rect x="66" y="72" width="10" height="5" rx="2" fill="#64748B" />
            {/* Animated Squatting Body + Barbell */}
            <g className="gym-ex-squat">
              <line x1="22" y1="30" x2="98" y2="30" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
              <rect x="18" y="21" width="6" height="18" rx="2" fill="#C8F135" />
              <rect x="96" y="21" width="6" height="18" rx="2" fill="#C8F135" />
              <circle cx="60" cy="24" r="6" fill="#94A3B8" />
              <rect x="53" y="31" width="14" height="22" rx="5" fill="#C8F135" fillOpacity="0.85" />
              <line x1="55" y1="52" x2="49" y2="72" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
              <line x1="65" y1="52" x2="71" y2="72" stroke="#94A3B8" strokeWidth="4" strokeLinecap="round" />
            </g>
          </g>
        )}

        {resolvedKey === 'shoulder_press' && (
          <g>
            <circle cx="60" cy="48" r="6" fill="#64748B" />
            <rect x="53" y="55" width="14" height="22" rx="4" fill="#94A3B8" />
            <g className="gym-ex-press">
              <line x1="30" y1="30" x2="90" y2="30" stroke="#E2E8F0" strokeWidth="3" strokeLinecap="round" />
              <rect x="26" y="22" width="6" height="16" rx="2" fill="#C8F135" />
              <rect x="88" y="22" width="6" height="16" rx="2" fill="#C8F135" />
              <line x1="42" y1="30" x2="54" y2="56" stroke="#C8F135" strokeWidth="2.5" strokeLinecap="round" />
              <line x1="78" y1="30" x2="66" y2="56" stroke="#C8F135" strokeWidth="2.5" strokeLinecap="round" />
            </g>
          </g>
        )}

        {(resolvedKey === 'bicep_curl' || resolvedKey === 'tricep_pushdown') && (
          <g>
            {/* Torso */}
            <circle cx="48" cy="24" r="6" fill="#64748B" />
            <rect x="42" y="31" width="12" height="28" rx="4" fill="#94A3B8" />
            {/* Upper Arm */}
            <line x1="48" y1="35" x2="52" y2="52" stroke="#CBD5E1" strokeWidth="4" strokeLinecap="round" />
            {/* Forearm + Dumbbell/Rope */}
            <g className={resolvedKey === 'bicep_curl' ? 'gym-ex-curl' : 'gym-ex-pull'}>
              <line x1="52" y1="52" x2="78" y2="52" stroke="#C8F135" strokeWidth="4" strokeLinecap="round" />
              <circle cx="80" cy="52" r="6" fill="#C8F135" />
            </g>
          </g>
        )}

        {resolvedKey === 'core_plank' && (
          <g>
            <g className="gym-ex-press">
              <circle cx="28" cy="50" r="5.5" fill="#94A3B8" />
              <line x1="34" y1="52" x2="76" y2="56" stroke="#C8F135" strokeWidth="7" strokeLinecap="round" />
              <line x1="36" y1="54" x2="32" y2="74" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="76" y1="57" x2="86" y2="74" stroke="#CBD5E1" strokeWidth="3.5" strokeLinecap="round" />
            </g>
          </g>
        )}

        {resolvedKey === 'cardio_hiit' && (
          <g>
            {/* Treadmill deck */}
            <line x1="20" y1="74" x2="100" y2="70" stroke="#334155" strokeWidth="5" strokeLinecap="round" />
            <line x1="88" y1="70" x2="94" y2="34" stroke="#475569" strokeWidth="3" strokeLinecap="round" />
            {/* Running figure */}
            <g className="gym-ex-cardio">
              <circle cx="62" cy="28" r="6" fill="#94A3B8" />
              <line x1="60" y1="35" x2="55" y2="54" stroke="#C8F135" strokeWidth="6" strokeLinecap="round" />
              <line x1="55" y1="54" x2="42" y2="69" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
              <line x1="55" y1="54" x2="70" y2="66" stroke="#E2E8F0" strokeWidth="3.5" strokeLinecap="round" />
            </g>
          </g>
        )}
      </svg>

      {variant === 'stage' && (
        <span className="absolute bottom-2.5 right-3 rounded-full bg-white/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#C8F135]">
          Form Loop
        </span>
      )}
    </div>
  );
}
