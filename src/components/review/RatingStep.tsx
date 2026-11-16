import { ArrowRight, Check } from 'lucide-react';
import type { ExperienceRating } from '../../types/business';
import { RATING_OPTIONS } from '../../config/reviewExperience';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

interface Props {
  selected: ExperienceRating | null;
  onSelect: (rating: ExperienceRating) => void;
  onNext: () => void;
}

export function RatingStep({ selected, onSelect, onNext }: Props) {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-1.5">
        <h2 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[26px]">
          How would you rate your experience?
        </h2>
        <p className="text-[14px] text-[#626B65]">Just pick one.</p>
      </div>

      <div className="grid grid-cols-2 gap-3.5">
        {RATING_OPTIONS.map((opt) => {
          const active = selected === opt.id;
          return (
            <button
              key={opt.id}
              type="button"
              onClick={() => onSelect(opt.id)}
              aria-pressed={active}
              className={cn(
                'relative flex flex-col items-center justify-center rounded-2xl border px-3 py-6 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
                active
                  ? 'border-[#244B40] bg-[#EEF3EC]/80 ring-1 ring-[#244B40] motion-safe:animate-pop-in'
                  : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40]/60 hover:bg-[#F7F7F2]',
              )}
            >
              {active && (
                <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#244B40] text-white shadow-xs">
                  <Check className="h-3.5 w-3.5" aria-hidden />
                </span>
              )}
              <span
                className="text-4xl leading-none transition-transform duration-200"
                style={{ transform: active ? 'scale(1.12)' : 'scale(1)' }}
                aria-hidden
              >
                {opt.emoji}
              </span>
              <span className="mt-3 text-[15px] font-semibold text-[#252B29]">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>

      <Button
        type="button"
        disabled={!selected}
        onClick={onNext}
        className="w-full rounded-full text-[15px] font-semibold"
      >
        Next <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
