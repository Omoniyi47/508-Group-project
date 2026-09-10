import { Spinner } from './Spinner';

const VARIANTS = {
  primary: 'bg-indigo text-white hover:bg-indigo/90 focus-visible:outline-indigo',
  secondary: 'bg-white text-navy border border-slate/30 hover:bg-off-white',
  teal: 'bg-teal text-white hover:bg-teal/90',
  danger: 'bg-danger text-white hover:bg-danger/90',
  ghost: 'text-navy hover:bg-slate/10',
};

const SIZES = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-4 py-2 text-sm',
  lg: 'px-5 py-2.5 text-base',
};

export function Button({
  children,
  variant = 'primary',
  size = 'md',
  isLoading = false,
  disabled = false,
  type = 'button',
  className = '',
  ...props
}) {
  return (
    <button
      type={type}
      disabled={disabled || isLoading}
      className={`inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTS[variant]} ${SIZES[size]} ${className}`}
      {...props}
    >
      {isLoading && <Spinner size="sm" className="text-current" />}
      {children}
    </button>
  );
}
