import { ArrowLeft } from 'lucide-react';
import type { ReviewFlowStep } from '../../types/business';

interface Props {
  current: ReviewFlowStep;
  onBack?: () => void;
}

const STEP_NUM: Record<ReviewFlowStep, number | null> = {
  welcome: null,
  rating: 1,
  highlights: 2,
  review: 3,
  thanks: null,
};

export function ProgressSteps({ current, onBack }: Props) {
  const num = STEP_NUM[current];
  if (num === null) return null;

  const pct = Math.round((num / 3) * 100);

  return (
    <div className="flex items-center justify-between gap-4 pb-2">
      <button
        type="button"
        onClick={onBack}
        aria-label="Go back"
        className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#252B29] hover:bg-[#EEF3EC] transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]"
      >
        <ArrowLeft className="h-5 w-5" aria-hidden />
      </button>

      <div className="flex items-center gap-3">
        <span className="text-[13px] font-semibold tabular-nums text-[#252B29]">
          {num} / 3
        </span>
        <div
          className="h-1.5 w-24 overflow-hidden rounded-full bg-[#DDE4DC]"
          role="progressbar"
          aria-valuenow={num}
          aria-valuemin={1}
          aria-valuemax={3}
        >
          <div
            className="h-full rounded-full bg-[#244B40] transition-all duration-300"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      <span className="w-9" aria-hidden />
    </div>
  );
}
