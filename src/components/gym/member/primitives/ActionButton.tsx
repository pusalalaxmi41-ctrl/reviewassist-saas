import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ActionButtonVariant =
  | 'primary'
  | 'secondary'
  | 'outline'
  | 'ghost'
  | 'danger';

export interface ActionButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ActionButtonVariant;
  accentColor?: string;
  accentInk?: string;
  fullWidth?: boolean;
  children: ReactNode;
}

/** Consistent touch-friendly (>= 44px) button obeying dynamic gym accent & ink contrast. */
export function ActionButton({
  variant = 'primary',
  accentColor,
  accentInk,
  fullWidth = false,
  className = '',
  style,
  type = 'button',
  children,
  ...rest
}: ActionButtonProps) {
  const widthCls = fullWidth ? 'w-full' : '';
  const base =
    'gym-tactile inline-flex min-h-[44px] items-center justify-center gap-2 rounded-2xl px-4 text-[13.5px] font-black transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

  const variantClasses: Record<ActionButtonVariant, string> = {
    primary: 'shadow-md',
    secondary:
      'bg-[#232933] text-[#F5F7FA] border border-white/[0.08] hover:bg-[#2A313D]',
    outline:
      'bg-transparent text-[#F5F7FA] border border-white/15 hover:bg-white/[0.05]',
    ghost:
      'bg-transparent text-[#A4ADBB] hover:text-[#F5F7FA] hover:bg-white/[0.05]',
    danger:
      'bg-rose-500/15 text-rose-300 border border-rose-500/35 hover:bg-rose-500/25',
  };

  const primaryStyle =
    variant === 'primary'
      ? {
          backgroundColor: accentColor ?? 'var(--gym-accent, #C8F135)',
          color: accentInk ?? 'var(--gym-accent-ink, #0B0D10)',
          ...style,
        }
      : style;

  return (
    <button
      type={type}
      className={`${base} ${variantClasses[variant]} ${widthCls} ${className}`.trim()}
      style={primaryStyle}
      {...rest}
    >
      {children}
    </button>
  );
}
