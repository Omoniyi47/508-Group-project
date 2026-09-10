import { forwardRef, useId } from 'react';

export const Input = forwardRef(function Input({ label, error, hint, required, className = '', type = 'text', ...props }, ref) {
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
      <input
        ref={ref}
        id={id}
        type={type}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`rounded-lg border px-3 py-2 text-sm text-navy placeholder:text-slate/60 focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20 ${
          error ? 'border-danger' : 'border-slate/30'
        } ${className}`}
        {...props}
      />
      {hint && <p className="text-xs text-slate">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
