import { useState } from 'react';
import { ArrowRight, Check, Leaf, Mic, PenLine, Star } from 'lucide-react';
import type { Business, ExperienceInputMode } from '../../types/business';
import { getCategoryExperience } from '../../config/reviewExperience';
import { Button } from '../common/Button';
import { cn } from '../../utils/cn';

interface Props {
  business: Business;
  initialMode?: ExperienceInputMode;
  onSelect: (mode: ExperienceInputMode) => void;
}

export function WelcomeStep({
  business,
  initialMode = 'text',
  onSelect,
}: Props) {
  const [selectedMode, setSelectedMode] = useState<ExperienceInputMode>(initialMode);
  const cat = getCategoryExperience(business.category);

  return (
    <div className="space-y-6 text-center">
      {/* Brand Badge */}
      <div className="inline-flex items-center justify-center gap-2">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#244B40] text-white">
          <Leaf className="h-4 w-4" aria-hidden />
        </span>
        <span className="text-[17px] font-bold tracking-tight text-[#252B29]">
          Vitaran AI Reviews
        </span>
      </div>

      {/* Storefront + 5 Stars + Category Floating Emojis */}
      <div className="relative mx-auto flex max-w-[260px] flex-col items-center py-2">
        <div className="pointer-events-none absolute -left-2 top-3 text-2xl opacity-85">
          {cat.sceneEmojis[0]}
        </div>
        <div className="pointer-events-none absolute -right-2 top-5 text-2xl opacity-85">
          {cat.sceneEmojis[1]}
        </div>
        <div className="pointer-events-none absolute right-4 bottom-2 text-xl opacity-85">
          {cat.sceneEmojis[2]}
        </div>

        {/* 5-star speech bubble */}
        <div className="relative z-10 inline-flex items-center gap-1 rounded-2xl border border-[#DDE4DC] bg-[#FFFFFF] px-4 py-2 shadow-xs">
          {[0, 1, 2, 3, 4].map((i) => (
            <Star
              key={i}
              className="h-5 w-5 fill-[#E4BD63] text-[#E4BD63]"
              aria-hidden
            />
          ))}
        </div>

        {/* Storefront Card */}
        <div className="relative -mt-2 flex h-24 w-28 flex-col items-center justify-center rounded-2xl border border-[#A8BFA5] bg-[#EEF3EC] shadow-2xs">
          <span className="text-4xl" aria-hidden>
            {cat.emoji}
          </span>
        </div>

        <span className="mt-2.5 inline-flex items-center gap-1.5 rounded-full border border-[#DDE4DC] bg-[#F7F7F2] px-3 py-0.5 text-[12px] font-semibold text-[#244B40]">
          {business.name} · {business.city}
        </span>
      </div>

      {/* Heading */}
      <div className="space-y-1.5">
        <h1 className="text-[24px] font-bold tracking-tight text-[#252B29] sm:text-[26px]">
          How was your experience?
        </h1>
        <p className="text-[14px] text-[#626B65]">
          {cat.greeting} Choose how you&apos;d like to share your feedback.
        </p>
      </div>

      {/* Write / Speak 2-card selector */}
      <div className="grid grid-cols-2 gap-3 text-center">
        <button
          type="button"
          onClick={() => setSelectedMode('text')}
          aria-pressed={selectedMode === 'text'}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-2xl border p-4 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
            selectedMode === 'text'
              ? 'border-[#244B40] bg-[#EEF3EC]/70 ring-1 ring-[#244B40]'
              : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40]/60',
          )}
        >
          {selectedMode === 'text' && (
            <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#244B40] text-white shadow-xs">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F7F2] text-[#244B40]">
            <PenLine className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold text-[#252B29]">Write</span>
          <span className="mt-0.5 text-[12px] text-[#626B65]">Tap or type review</span>
        </button>

        <button
          type="button"
          onClick={() => setSelectedMode('voice')}
          aria-pressed={selectedMode === 'voice'}
          className={cn(
            'relative flex flex-col items-center justify-center rounded-2xl border p-4 transition-all cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40]',
            selectedMode === 'voice'
              ? 'border-[#244B40] bg-[#EEF3EC]/70 ring-1 ring-[#244B40]'
              : 'border-[#DDE4DC] bg-[#FFFFFF] hover:border-[#244B40]/60',
          )}
        >
          {selectedMode === 'voice' && (
            <span className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-[#244B40] text-white shadow-xs">
              <Check className="h-3.5 w-3.5" aria-hidden />
            </span>
          )}
          <span className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-[#F7F7F2] text-[#244B40]">
            <Mic className="h-5 w-5" aria-hidden />
          </span>
          <span className="text-[15px] font-semibold text-[#252B29]">Speak</span>
          <span className="mt-0.5 text-[12px] text-[#626B65]">Use your voice</span>
        </button>
      </div>

      {/* Primary CTA */}
      <Button
        type="button"
        onClick={() => onSelect(selectedMode)}
        className="w-full rounded-full text-[15px] font-semibold"
      >
        Next <ArrowRight className="h-4 w-4" aria-hidden />
      </Button>
    </div>
  );
}
