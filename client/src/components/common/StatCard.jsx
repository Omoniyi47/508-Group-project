import { Link } from 'react-router-dom';

const TONES = {
  neutral: 'border-l-slate',
  brand: 'border-l-indigo',
  teal: 'border-l-teal',
  warning: 'border-l-warning',
  danger: 'border-l-danger',
};

export function StatCard({ value, label, to, tone = 'neutral' }) {
  const content = (
    <div className={`rounded-xl border border-l-4 border-slate/15 ${TONES[tone]} bg-white p-4 transition-shadow hover:shadow-md`}>
      <p className="text-2xl font-bold text-navy">{value}</p>
      <p className="mt-1 text-xs text-slate">{label}</p>
    </div>
  );

  return to ? <Link to={to}>{content}</Link> : content;
}
