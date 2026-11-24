import type { ReactNode } from 'react';
import { SurfaceCard } from './SurfaceCard';
import { ImageWithFallback } from './ImageWithFallback';

export interface EmptyStateCardProps {
  imageSrc: string;
  imageAlt: string;
  title: string;
  description: string;
  fallbackIcon?: ReactNode;
  action?: ReactNode;
}

/** Curated obsidian empty-state block pairing 1:1 3D WebP props with contextual guidance. */
export function EmptyStateCard({
  imageSrc,
  imageAlt,
  title,
  description,
  fallbackIcon,
  action,
}: EmptyStateCardProps) {
  return (
    <SurfaceCard className="flex flex-col items-center justify-center py-7 px-5 text-center space-y-3">
      <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-2xl border border-white/[0.08] bg-[#111419]">
        <ImageWithFallback
          src={imageSrc}
          alt={imageAlt}
          className="h-full w-full object-cover"
          fallback={fallbackIcon}
        />
      </div>
      <div className="max-w-xs space-y-1">
        <p className="text-[14.5px] font-extrabold text-[#F5F7FA]">{title}</p>
        <p className="text-[12.5px] text-[#A4ADBB] leading-relaxed">
          {description}
        </p>
      </div>
      {action && <div className="pt-1">{action}</div>}
    </SurfaceCard>
  );
}
