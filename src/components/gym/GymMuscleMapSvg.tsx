import type { GymCatalogMuscleGroup, GymMuscleGroup } from '../../types/gym';

interface Props {
  activeMuscles?: ReadonlyArray<GymMuscleGroup | GymCatalogMuscleGroup | string>;
  recoveringMuscles?: ReadonlyArray<GymMuscleGroup | string>;
  compact?: boolean;
}

function normalizeSet(
  list: ReadonlyArray<string> = [],
): Set<string> {
  const out = new Set<string>();
  for (const item of list) {
    const key = item.toLowerCase();
    out.add(key);
    if (key === 'arms') {
      out.add('biceps');
      out.add('triceps');
    }
    if (key === 'legs') {
      out.add('quads');
      out.add('hamstrings');
      out.add('glutes');
      out.add('calves');
    }
    if (key === 'full_body') {
      out.add('chest');
      out.add('back');
      out.add('shoulders');
      out.add('biceps');
      out.add('triceps');
      out.add('quads');
      out.add('core');
    }
  }
  return out;
}

/**
 * Pure SVG Front & Back Athletic Muscle Map (zero external dependencies).
 * Highlights target/trained muscles in Volt Lime (#C8F135) and recovering muscles in Amber (#F59E0B).
 */
export function GymMuscleMapSvg({
  activeMuscles = [],
  recoveringMuscles = [],
  compact = false,
}: Props) {
  const activeSet = normalizeSet(activeMuscles);
  const recoverSet = normalizeSet(recoveringMuscles);

  function fillFor(muscle: string): string {
    if (activeSet.has(muscle)) return '#C8F135';
    if (recoverSet.has(muscle)) return '#F59E0B';
    return '#2A303C';
  }

  return (
    <div
      className={`flex items-center justify-center gap-4 ${compact ? 'py-1' : 'py-2'}`}
      aria-label="Muscle Group Body Map"
    >
      {/* FRONT VIEW */}
      <div className="flex flex-col items-center gap-1">
        <svg
          viewBox="0 0 110 210"
          className={compact ? 'h-28 w-16' : 'h-40 w-24'}
          role="img"
          aria-label="Front muscles"
        >
          {/* Head & Neck */}
          <circle cx="55" cy="18" r="11" fill="#374151" />
          <rect x="49" y="29" width="12" height="8" rx="3" fill="#374151" />
          {/* Shoulders */}
          <ellipse cx="32" cy="46" rx="9" ry="7" fill={fillFor('shoulders')} />
          <ellipse cx="78" cy="46" rx="9" ry="7" fill={fillFor('shoulders')} />
          {/* Chest */}
          <path
            d="M38 40 Q55 36 72 40 L70 60 Q55 64 40 60 Z"
            fill={fillFor('chest')}
          />
          {/* Biceps / Arms */}
          <rect x="21" y="53" width="11" height="28" rx="5" fill={fillFor('biceps')} />
          <rect x="78" y="53" width="11" height="28" rx="5" fill={fillFor('biceps')} />
          {/* Forearms */}
          <rect x="19" y="83" width="9" height="24" rx="4" fill="#374151" />
          <rect x="82" y="83" width="9" height="24" rx="4" fill="#374151" />
          {/* Core / Abs */}
          <rect x="42" y="64" width="26" height="36" rx="6" fill={fillFor('core')} />
          {/* Quads */}
          <path
            d="M38 104 L53 104 L51 150 L39 150 Z"
            fill={fillFor('quads')}
          />
          <path
            d="M57 104 L72 104 L71 150 L59 150 Z"
            fill={fillFor('quads')}
          />
          {/* Lower legs / Shins */}
          <rect x="40" y="154" width="10" height="44" rx="5" fill={fillFor('calves')} />
          <rect x="60" y="154" width="10" height="44" rx="5" fill={fillFor('calves')} />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Front
        </span>
      </div>

      {/* BACK VIEW */}
      <div className="flex flex-col items-center gap-1">
        <svg
          viewBox="0 0 110 210"
          className={compact ? 'h-28 w-16' : 'h-40 w-24'}
          role="img"
          aria-label="Back muscles"
        >
          {/* Head & Neck */}
          <circle cx="55" cy="18" r="11" fill="#374151" />
          <rect x="49" y="29" width="12" height="8" rx="3" fill="#374151" />
          {/* Rear Shoulders */}
          <ellipse cx="32" cy="46" rx="9" ry="7" fill={fillFor('shoulders')} />
          <ellipse cx="78" cy="46" rx="9" ry="7" fill={fillFor('shoulders')} />
          {/* Upper & Mid Back (Lats & Traps) */}
          <path
            d="M36 40 L74 40 L68 88 L42 88 Z"
            fill={fillFor('back')}
          />
          {/* Triceps */}
          <rect x="21" y="53" width="11" height="28" rx="5" fill={fillFor('triceps')} />
          <rect x="78" y="53" width="11" height="28" rx="5" fill={fillFor('triceps')} />
          {/* Forearms */}
          <rect x="19" y="83" width="9" height="24" rx="4" fill="#374151" />
          <rect x="82" y="83" width="9" height="24" rx="4" fill="#374151" />
          {/* Glutes */}
          <ellipse cx="47" cy="102" rx="11" ry="11" fill={fillFor('glutes')} />
          <ellipse cx="63" cy="102" rx="11" ry="11" fill={fillFor('glutes')} />
          {/* Hamstrings */}
          <rect x="38" y="114" width="14" height="36" rx="6" fill={fillFor('hamstrings')} />
          <rect x="58" y="114" width="14" height="36" rx="6" fill={fillFor('hamstrings')} />
          {/* Calves */}
          <ellipse cx="45" cy="172" rx="7" ry="18" fill={fillFor('calves')} />
          <ellipse cx="65" cy="172" rx="7" ry="18" fill={fillFor('calves')} />
        </svg>
        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
          Back
        </span>
      </div>
    </div>
  );
}
