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
    'bg-[#1E1B4B] text-[#FFFFFF] hover:bg-[#2E2A6E] border border-[#1E1B4B] shadow-sm disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB]',
  secondary:
    'bg-[#FFFFFF] text-[#111827] border border-[#1E1B4B]/20 hover:bg-[#F8F9FA] hover:border-[#1E1B4B] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:border-[#E5E7EB]',
  ghost:
    'bg-transparent text-[#111827] hover:bg-[#1E1B4B]/[0.06] hover:text-[#1E1B4B] disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]',
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
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-semibold transition-all duration-150 active:scale-[0.98] cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#1E1B4B] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:active:scale-100',
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
