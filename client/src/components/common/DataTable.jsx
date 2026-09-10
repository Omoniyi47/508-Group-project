export function DataTable({ columns, rows, rowKey = '_id', actions }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-full divide-y divide-slate/15 text-left text-sm">
        <thead className="bg-off-white">
          <tr>
            {columns.map((col) => (
              <th key={col.key} scope="col" className="px-4 py-3 font-medium text-slate">
                {col.label}
              </th>
            ))}
            {actions && (
              <th scope="col" className="px-4 py-3 text-right font-medium text-slate">
                Actions
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate/10 bg-white">
          {rows.map((row) => (
            <tr key={row[rowKey]} className="hover:bg-off-white/60">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3 text-navy">
                  {col.render ? col.render(row) : (row[col.key] ?? '—')}
                </td>
              ))}
              {actions && <td className="px-4 py-3 text-right">{actions(row)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
