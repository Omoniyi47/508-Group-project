export function EmptyState({ title = 'Nothing here yet', description, action }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-slate/30 bg-white px-6 py-12 text-center">
      <p className="text-sm font-medium text-navy">{title}</p>
      {description && <p className="max-w-sm text-sm text-slate">{description}</p>}
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
