// Solid backgrounds paired with whichever ink (navy/white) actually clears 4.5:1 contrast for
// that color - a light tint (e.g. bg-warning/10 + text-warning) looks nicer but measures under
// 3:1 for warning/teal/slate, failing WCAG AA for this text size.
const STYLES = {
  draft: 'bg-slate text-white',
  submitted: 'bg-warning text-navy',
  approved: 'bg-success text-navy',
  rejected: 'bg-danger text-white',
  pending: 'bg-warning text-navy',
  verified: 'bg-teal text-navy',
  requested: 'bg-slate text-white',
  released: 'bg-success text-navy',
};

export function StatusBadge({ status }) {
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium capitalize ${STYLES[status] || 'bg-slate text-white'}`}>
      {status}
    </span>
  );
}
