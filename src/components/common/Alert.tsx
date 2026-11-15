import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

type Tone = 'info' | 'warning' | 'success' | 'error';

const styles: Record<Tone, string> = {
  info: 'border-[#DDE4DC] bg-[#EEF3EC] text-[#252B29]',
  warning: 'border-[#E4BD63] bg-[#FAF3DF] text-[#252B29]',
  success: 'border-[#A8BFA5] bg-[#EEF3EC] text-[#252B29]',
  error: 'border-red-300 bg-red-50 text-red-950',
};

const iconStyles: Record<Tone, string> = {
  info: 'text-[#244B40]',
  warning: 'text-[#252B29]',
  success: 'text-[#244B40]',
  error: 'text-red-700',
};

const icons = {
  info: Info,
  warning: AlertTriangle,
  success: CheckCircle2,
  error: XCircle,
};

export function Alert({
  tone = 'info',
  children,
  className,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
}) {
  const Icon = icons[tone];
  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      aria-live={tone === 'error' ? 'assertive' : 'polite'}
      className={cn(
        'flex gap-3 rounded-xl border p-3.5 text-[14px] leading-relaxed',
        styles[tone],
        className,
      )}
    >
      <Icon
        className={cn('mt-0.5 h-4 w-4 shrink-0', iconStyles[tone])}
        aria-hidden
      />
      <div className="space-y-1">{children}</div>
    </div>
  );
}
