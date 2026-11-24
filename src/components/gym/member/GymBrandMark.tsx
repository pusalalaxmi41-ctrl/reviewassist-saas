import { useState } from 'react';
import { Dumbbell } from 'lucide-react';

export interface GymBrandMarkProps {
  logoUrl?: string | null;
  name: string;
  accentColor: string;
  inkColor: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Displays custom gym logo with clean error fallback to branded geometric mark. */
export function GymBrandMark({
  logoUrl,
  name,
  accentColor,
  inkColor,
  size = 'md',
}: GymBrandMarkProps) {
  const [imgErr, setImgErr] = useState(false);
  const boxCls =
    size === 'lg'
      ? 'h-16 w-16 rounded-2xl'
      : size === 'sm'
        ? 'h-9 w-9 rounded-xl'
        : 'h-10 w-10 rounded-xl';

  if (logoUrl && !imgErr) {
    return (
      <img
        src={logoUrl}
        alt={`${name} logo`}
        onError={() => setImgErr(true)}
        className={`${boxCls} shrink-0 object-cover border border-white/15 bg-[#171B22] shadow-sm`}
      />
    );
  }

  return (
    <span
      className={`flex ${boxCls} shrink-0 items-center justify-center shadow-sm`}
      style={{
        backgroundColor: accentColor,
        color: inkColor,
      }}
    >
      <Dumbbell
        className={size === 'lg' ? 'h-8 w-8' : 'h-5 w-5'}
        aria-hidden
      />
    </span>
  );
}
