import type { ReactNode } from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../utils/cn';

type Tone = 'info' | 'warning' | 'success' | 'error';

const styles: Record<Tone, string> = {
  info: 'border-[#1E1B4B]/15 bg-[#1E1B4B]/[0.04] text-[#111827]',
  warning: 'border-[#D97706]/30 bg-amber-50/80 text-[#111827]',
  success: 'border-[#059669]/30 bg-emerald-50/80 text-[#111827]',
  error: 'border-red-300 bg-red-50 text-red-950',
};

const iconStyles: Record<Tone, string> = {
  info: 'text-[#1E1B4B]',
  warning: 'text-[#D97706]',
  success: 'text-[#059669]',
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
        'flex gap-3 rounded-2xl border p-4 text-[14px] leading-relaxed',
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
