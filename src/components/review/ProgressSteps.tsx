import type { ReviewFlowStep } from '../../types/business';
import { cn } from '../../utils/cn';

const steps: { id: ReviewFlowStep; label: string }[] = [
  { id: 'welcome', label: 'Start' },
  { id: 'experience', label: 'Experience' },
  { id: 'review', label: 'Review' },
  { id: 'google', label: 'Post' },
];

export function ProgressSteps({ current }: { current: ReviewFlowStep }) {
  const index = steps.findIndex((s) => s.id === current);
  return (
    <nav aria-label="Progress">
      <p className="sr-only">Step {index + 1} of {steps.length}: {steps[index].label}</p>
      <ol className="flex gap-2" aria-hidden>
        {steps.map((s, i) => (
          <li key={s.id} className="flex-1">
            <div className={cn('h-1.5 rounded-full transition-colors duration-300', i <= index ? 'bg-indigo-600' : 'bg-slate-200')} />
            <span className={cn('mt-1.5 block text-xs', i === index ? 'font-medium text-slate-900' : 'text-slate-500')}>
              {s.label}
            </span>
          </li>
        ))}
      </ol>
    </nav>
  );
}
