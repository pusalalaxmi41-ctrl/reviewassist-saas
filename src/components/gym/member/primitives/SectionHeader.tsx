import type { ReactNode } from 'react';

export interface SectionHeaderProps {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  action?: ReactNode;
  accentText?: string;
}

/** Standard section heading pairing eyebrow tag, title, and optional right action link. */
export function SectionHeader({
  eyebrow,
  title,
  subtitle,
  action,
  accentText,
}: SectionHeaderProps) {
  return (
    <div className="flex items-end justify-between gap-3">
      <div className="min-w-0">
        {eyebrow && (
          <p
            className="text-[10.5px] font-extrabold uppercase tracking-[0.06em]"
            style={{ color: accentText ?? 'var(--gym-accent-text, #C8F135)' }}
          >
            {eyebrow}
          </p>
        )}
        <h2 className="text-[16px] font-extrabold text-[#F5F7FA] leading-tight">
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-[12px] text-[#A4ADBB]">{subtitle}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
