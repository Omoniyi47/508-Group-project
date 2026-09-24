import { forwardRef, useId } from 'react';

export const Select = forwardRef(function Select(
  { label, error, required, options = [], placeholder = 'Select...', className = '', isLoading = false, loadError = '', emptyMessage = 'No options available.', onRetry, ...props },
  ref
) {
  const generatedId = useId();
  const id = props.id || generatedId;
  const status = isLoading ? 'Loading options...' : loadError || (!options.length ? emptyMessage : '');
  const describedBy = [props['aria-describedby'], error && `${id}-error`, status && `${id}-status`].filter(Boolean).join(' ') || undefined;

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
        className={`rounded-lg border bg-white px-3 py-2 text-sm text-navy disabled:cursor-not-allowed disabled:bg-off-white focus:border-indigo focus:outline-none focus:ring-2 focus:ring-indigo/20 ${
          error ? 'border-danger' : 'border-slate/30'
        } ${className}`}
        {...props}
        disabled={props.disabled || (isLoading && !options.length) || (required && !options.length)}
        aria-busy={isLoading}
        aria-describedby={describedBy}
      >
        <option value="">{isLoading && !options.length ? 'Loading options...' : loadError && !options.length ? 'Unable to load options' : required && !options.length && !props.disabled ? 'No options available' : placeholder}</option>
        {options.length === 0 && <option disabled>No options available</option>}
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {status && (
        <div id={`${id}-status`} role="status" className="text-xs text-slate">
          {status}
          {!isLoading && onRetry && <button type="button" aria-label={`Reload ${label || props['aria-label'] || 'options'}`} className="ml-2 font-medium text-indigo underline" onClick={onRetry}>Reload options</button>}
        </div>
      )}
      {error && (
        <p id={`${id}-error`} className="text-sm text-danger">
          {error}
        </p>
      )}
    </div>
  );
});
