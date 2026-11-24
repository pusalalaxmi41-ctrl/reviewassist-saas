import type { HTMLAttributes, ReactNode } from 'react';

export type SurfaceCardVariant = 'standard' | 'elevated' | 'hero' | 'compact';

const VARIANT_CLASSES: Record<SurfaceCardVariant, string> = {
  standard:
    'rounded-2xl bg-[#171B22] border border-white/[0.08] p-4',
  elevated:
    'rounded-2xl bg-[#1D222B] border border-white/[0.1] p-4 shadow-lg',
  hero:
    'relative overflow-hidden rounded-3xl bg-[#171B22] border border-white/[0.1] p-5 shadow-xl',
  compact:
    'rounded-2xl bg-[#171B22] border border-white/[0.07] p-3.5',
};

export interface SurfaceCardProps extends HTMLAttributes<HTMLDivElement> {
  variant?: SurfaceCardVariant;
  children: ReactNode;
}

/** Unified obsidian surface card adhering to FitPro spacing and 1px hairline border tokens. */
export function SurfaceCard({
  variant = 'standard',
  className = '',
  children,
  ...rest
}: SurfaceCardProps) {
  return (
    <div className={`${VARIANT_CLASSES[variant]} ${className}`.trim()} {...rest}>
      {children}
    </div>
  );
}
