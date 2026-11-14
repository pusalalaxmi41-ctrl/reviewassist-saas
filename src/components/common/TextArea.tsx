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
      <label htmlFor={inputId} className={cn('block text-sm font-medium text-slate-700', hideLabel && 'sr-only')}>
        {label}
      </label>
      <textarea
        ref={ref}
        id={inputId}
        aria-invalid={Boolean(error) || undefined}
        aria-describedby={[hint && hintId, error && errorId].filter(Boolean).join(' ') || undefined}
        className={cn(
          'block w-full resize-y rounded-lg border bg-white px-3 py-3 text-base leading-relaxed focus:outline-none focus:ring-2 sm:text-sm',
          error
            ? 'border-red-400 focus:border-red-500 focus:ring-red-500/30'
            : 'border-slate-300 focus:border-indigo-500 focus:ring-indigo-500/30',
          className,
        )}
        {...props}
      />
      {hint && <p id={hintId} className="text-xs text-slate-500">{hint}</p>}
      {error && <p id={errorId} role="alert" className="text-sm text-red-600">{error}</p>}
    </div>
  );
});
