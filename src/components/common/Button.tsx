import type { ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';
import { cn } from '../../utils/cn';

type Variant = 'primary' | 'secondary' | 'ghost';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  loading?: boolean;
}

const variants: Record<Variant, string> = {
  primary:
    'bg-[#1E1B4B] text-[#FFFFFF] hover:bg-[#2E2A6E] border border-[#1E1B4B] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB]',
  secondary:
    'bg-[#FFFFFF] text-[#111827] border border-slate-200 hover:bg-slate-50 hover:border-slate-300 disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB]',
  ghost:
    'bg-transparent text-[#374151] hover:bg-slate-100 hover:text-[#111827] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]',
};

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        'inline-flex min-h-9.5 items-center justify-center gap-1.5 rounded-lg px-3.5 py-2 text-[13px] font-semibold transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] focus-visible:ring-offset-1 disabled:cursor-not-allowed',
        variants[variant],
        className,
      )}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
}
