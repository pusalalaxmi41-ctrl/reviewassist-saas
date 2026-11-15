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
    'bg-[#244B40] text-[#FFFFFF] hover:bg-[#1C3B32] border border-[#244B40] disabled:bg-[#E8EBE7] disabled:text-[#747B76] disabled:border-[#DDE4DC]',
  secondary:
    'bg-[#FFFFFF] text-[#252B29] border border-[#87928A] hover:bg-[#F7F7F2] hover:border-[#244B40] disabled:bg-[#E8EBE7] disabled:text-[#747B76] disabled:border-[#DDE4DC]',
  ghost:
    'bg-transparent text-[#252B29] hover:bg-[#EEF3EC] hover:text-[#244B40] disabled:bg-[#E8EBE7] disabled:text-[#747B76]',
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
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-[14px] font-medium transition-colors cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-[#244B40] focus-visible:ring-offset-2 disabled:cursor-not-allowed',
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
