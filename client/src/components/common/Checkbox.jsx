import { forwardRef, useId } from 'react';

export const Checkbox = forwardRef(function Checkbox({ label, className = '', ...props }, ref) {
  const generatedId = useId();
  const id = props.id || generatedId;

  return (
    <label htmlFor={id} className={`flex items-center gap-2 text-sm text-navy ${className}`}>
      <input
        ref={ref}
        id={id}
        type="checkbox"
        className="h-4 w-4 rounded border-slate/40 text-indigo focus:ring-2 focus:ring-indigo/30"
        {...props}
      />
      {label}
    </label>
  );
});
