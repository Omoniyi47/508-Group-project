import { forwardRef, useId } from 'react';

export const Select = forwardRef(function Select(
  { label, error, required, options, placeholder = 'Select...', className = '', ...props },
  ref
) {
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
      <select
        ref={ref}
        id={id}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : undefined}
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-navy focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20 ${
          error ? 'border-danger' : 'border-slate/30'
        } ${className}`}
        {...props}
      >
        <option value="">{placeholder}</option>
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
