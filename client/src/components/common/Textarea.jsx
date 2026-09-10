import { forwardRef, useId } from 'react';

export const Textarea = forwardRef(function Textarea({ label, error, required, className = '', rows = 3, ...props }, ref) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label htmlFor={id} className="text-sm font-medium text-navy">
          {label}
          {required && <span className="text-danger"> *</span>}
        </label>
      )}
      <textarea
        ref={ref}
        id={id}
        rows={rows}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`rounded-lg border px-3 py-2 text-sm text-navy placeholder:text-slate/60 focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20 ${
          error ? 'border-danger' : 'border-slate/30'
        } ${className}`}
        {...props}
      />
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
