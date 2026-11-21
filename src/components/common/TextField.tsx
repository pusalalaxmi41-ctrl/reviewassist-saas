import { useId, type InputHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  hint?: string;
  error?: string | null;
}

export function TextField({
  label,
  hint,
  error,
  id,
  className,
  ...props
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className="block text-[13px] font-semibold text-[#111827] sm:text-[14px]"
      >
        {label}
      </label>
      <input
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={
          [hint && hintId, error && errorId].filter(Boolean).join(' ') ||
          undefined
        }
        className={cn(
          'block h-11 min-h-11 w-full rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 text-[15px] text-[#111827] placeholder:text-[#6B7280] transition-colors focus:outline-none focus-visible:ring-2 disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]',
          error
            ? 'border-red-600 focus-visible:border-red-600 focus-visible:ring-red-600/30'
            : 'border-[#1E1B4B]/20 focus-visible:border-[#1E1B4B] focus-visible:ring-[#1E1B4B]/25',
          className,
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-[13px] text-[#6B7280]">
          {hint}
        </p>
      )}
      {error && (
        <p id={errorId} role="alert" className="text-[13px] font-medium text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}
