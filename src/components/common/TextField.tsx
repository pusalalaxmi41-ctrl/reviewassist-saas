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
        className="block text-[13px] font-medium text-[#252B29] sm:text-[14px]"
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
          'block min-h-11 w-full rounded-xl border bg-[#FFFFFF] px-3.5 py-2.5 text-[15px] text-[#252B29] placeholder:text-[#626B65] focus:outline-none focus-visible:ring-2 disabled:bg-[#E8EBE7] disabled:text-[#747B76]',
          error
            ? 'border-red-600 focus-visible:border-red-600 focus-visible:ring-red-600/30'
            : 'border-[#87928A] focus-visible:border-[#244B40] focus-visible:ring-[#244B40]/25',
          className,
        )}
        {...props}
      />
      {hint && (
        <p id={hintId} className="text-[13px] text-[#626B65]">
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
