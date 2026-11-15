import { forwardRef, useId, type TextareaHTMLAttributes } from 'react';
import { cn } from '../../utils/cn';

interface TextAreaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  label: string;
  hint?: string;
  error?: string | null;
  hideLabel?: boolean;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, hint, error, hideLabel, id, className, ...props },
  ref,
) {
  const autoId = useId();
  const inputId = id ?? autoId;
  const hintId = `${inputId}-hint`;
  const errorId = `${inputId}-error`;
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={inputId}
        className={cn(
          'block text-[13px] font-medium text-[#252B29] sm:text-[14px]',
          hideLabel && 'sr-only',
        )}
      >
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={
          [hint && hintId, error && errorId].filter(Boolean).join(' ') ||
          undefined
        }
        className={cn(
          'block w-full resize-y rounded-xl border bg-[#FFFFFF] px-3.5 py-3 text-[15px] leading-relaxed text-[#252B29] placeholder:text-[#626B65] focus:outline-none focus-visible:ring-2 disabled:bg-[#E8EBE7] disabled:text-[#747B76] sm:text-[16px]',
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
});
