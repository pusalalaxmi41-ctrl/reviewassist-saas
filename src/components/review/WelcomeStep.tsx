import { Mic, PenLine, ChevronRight } from 'lucide-react';
import type { Business, ExperienceInputMode } from '../../types/business';
import { categoryLabels } from '../../services/business/mockBusinesses';

interface Props {
  business: Business;
  onSelect: (mode: ExperienceInputMode) => void;
}

const options: { mode: ExperienceInputMode; title: string; desc: string; Icon: typeof Mic }[] = [
  { mode: 'text', title: 'Write your experience', desc: 'Type a few lines in your own words.', Icon: PenLine },
  { mode: 'voice', title: 'Share through voice', desc: 'Speak and we will turn it into text.', Icon: Mic },
];

export function WelcomeStep({ business, onSelect }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">
          {categoryLabels[business.category]} · {business.city}
        </p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{business.name}</h1>
        <p className="mt-3 text-slate-600">
          Thank you for visiting! We'd love to hear about your experience — the good and the not-so-good.
        </p>
      </div>
      <div className="grid gap-3">
        {options.map(({ mode, title, desc, Icon }) => (
          <button
            key={mode}
            type="button"
            onClick={() => onSelect(mode)}
            className="group flex w-full items-center gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-colors hover:border-indigo-300 hover:bg-indigo-50/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <Icon className="h-5 w-5" aria-hidden />
            </span>
            <span className="flex-1">
              <span className="block font-medium">{title}</span>
              <span className="block text-sm text-slate-500">{desc}</span>
            </span>
            <ChevronRight className="h-5 w-5 text-slate-400 group-hover:text-indigo-600" aria-hidden />
          </button>
        ))}
      </div>
    </div>
  );
}
