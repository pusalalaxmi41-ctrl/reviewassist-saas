import type { ReviewFlowStep } from '../../types/business';
import { cn } from '../../utils/cn';

const steps: { id: ReviewFlowStep; label: string }[] = [
  { id: 'welcome', label: 'Welcome' },
  { id: 'experience', label: 'Your Visit' },
  { id: 'review', label: 'AI Review' },
  { id: 'google', label: 'Share' },
];

export function ProgressSteps({ current }: { current: ReviewFlowStep }) {
  const index = steps.findIndex((s) => s.id === current);

  return (
    <nav aria-label="Review progress" className="px-1">
      <div className="mb-2 flex items-center justify-between text-[13px]">
        <span className="font-medium text-[#252B29]">
          Step {index + 1} of {steps.length}
        </span>
        <span className="font-semibold text-[#244B40]">{steps[index]?.label}</span>
      </div>
      <ol className="grid grid-cols-4 gap-2" aria-hidden>
        {steps.map((s, i) => {
          const isCompleted = i < index;
          const isCurrent = i === index;
          return (
            <li key={s.id} className="space-y-1.5">
              <div
                className={cn(
                  'h-1.5 rounded-full transition-all duration-300',
                  isCompleted
                    ? 'bg-[#244B40]'
                    : isCurrent
                      ? 'bg-[#244B40] ring-2 ring-[#A8BFA5]/50'
                      : 'bg-[#DDE4DC]',
                )}
              />
              <span
                className={cn(
                  'block text-[13px] transition-colors',
                  isCurrent
                    ? 'font-semibold text-[#252B29]'
                    : isCompleted
                      ? 'font-medium text-[#244B40]'
                      : 'text-[#626B65]',
                )}
              >
                {s.label}
              </span>
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
